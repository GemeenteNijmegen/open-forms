import { randomUUID } from 'crypto';
import { Logger } from '@aws-lambda-powertools/logger';
import { MonitorRunRepository } from '../dynamodb/MonitorRunRepository';
import { persistProcessingResults, ScanCompleteness } from '../dynamodb/persistProcessingResults';
import { ProcessingIssueRepository } from '../dynamodb/ProcessingIssueRepository';
import { SubmissionExecutionReader } from '../executions/SubmissionExecutionReader';
import { EsfProcessingCounters, MonitorRun, RegularProcessingCounters } from '../model/MonitorRun';
import { ProcessingPeriodInput, resolveProcessingPeriod } from '../model/ProcessingPeriod';
import { ProcessingResult } from '../model/ProcessingResult';
import { ObjectRecordReader } from '../objects/ObjectRecordReader';
import { buildMonitorRunCounters } from '../processing/MonitorRunCounters';
import { checkProcessing } from '../processing/SubmissionProcessingChecker';
import { buildEsfProcessingReport, buildProcessingReport } from '../reporting/ProcessingReportBuilder';
import { ProcessingReportSender } from '../reporting/ProcessingReportSender';
import { RuntimeBudget } from '../RuntimeBudget';

const EMPTY_REGULAR_COUNTERS: RegularProcessingCounters = { total: 0, succeeded: 0, problem: 0 };
const EMPTY_ESF_COUNTERS: EsfProcessingCounters = {
  open: 0, verwerkt: 0, gesloten: 0, afgerond: 0, afgerondSucceeded: 0, afgerondProblem: 0, invalid: 0,
};

export interface MonitorHandlerOptions {
  /** @default new Date() */
  now?: Date;
  /** @default crypto.randomUUID() */
  runId?: string;
}

interface UnexpectedFailureContext {
  runId: string;
  period: { from: string; to: string };
  monitorRunStartedAt: Date;
  objectsScanned: number;
  objectRecordsFound: number;
  executionsScanned: number;
}

/**
 * Orchestrates one nightly monitor run: resolve the period, scan Objects and executions, check
 * processing, persist and report. Domain rules stay in the modules this composes - matching
 * objects/executions/model/processing/reporting - not duplicated here.
 */
export class MonitorHandler {
  constructor(
    private readonly objectRecordReader: ObjectRecordReader,
    private readonly executionReader: SubmissionExecutionReader,
    private readonly monitorRunRepository: MonitorRunRepository,
    private readonly processingIssueRepository: ProcessingIssueRepository,
    private readonly reportSender: ProcessingReportSender,
    private readonly reportRecipients: string[],
    private readonly esfReportRecipients: string[],
    private readonly reportEnabled: boolean,
    private readonly logger: Logger = new Logger({ serviceName: 'MonitorHandler' }),
  ) {}

  async run(periodInput: ProcessingPeriodInput, getRemainingTimeInMillis: () => number, options: MonitorHandlerOptions = {}): Promise<MonitorRun> {
    const runId = options.runId ?? randomUUID();
    const monitorRunStartedAt = options.now ?? new Date();
    const period = resolveProcessingPeriod(periodInput, monitorRunStartedAt);
    const runtimeBudget = new RuntimeBudget(getRemainingTimeInMillis);

    // Persistent for the rest of this invocation, so every log line from this handler and the
    // readers/sender it was constructed with (they share this logger) carries the same runId.
    this.logger.appendKeys({ runId });
    this.logger.info('Monitor run started', { period, monitorRunStartedAt });

    let objectsScanned = 0;
    let objectRecordsFound = 0;
    let executionsScanned = 0;

    try {
      const objectScan = await this.objectRecordReader.findRecordsInPeriod(period, runtimeBudget);
      objectsScanned = objectScan.objectsScanned;
      objectRecordsFound = objectScan.records.length;
      this.logger.info('Objects scan finished', {
        objectsScanned, objectRecordsFound, complete: objectScan.complete, remainingMs: runtimeBudget.remainingMs(),
      });

      const executionScan = await this.executionReader.listExecutionsWithMetadata(period, monitorRunStartedAt, runtimeBudget);
      executionsScanned = executionScan.executions.length;
      this.logger.info('Execution scan finished', {
        executionsScanned, complete: executionScan.complete, remainingMs: runtimeBudget.remainingMs(),
      });

      const completeness: ScanCompleteness = { objectsScanComplete: objectScan.complete, executionsScanComplete: executionScan.complete };
      let monitorRun: MonitorRun;
      let results: ProcessingResult[] | undefined;

      if (completeness.objectsScanComplete && completeness.executionsScanComplete) {
        results = checkProcessing(objectScan.records, executionScan.executions);
        const counters = buildMonitorRunCounters(objectScan.records, results);
        monitorRun = {
          runId,
          periodFrom: period.from,
          periodTo: period.to,
          startedAt: monitorRunStartedAt.toISOString(),
          completedAt: new Date().toISOString(),
          status: 'COMPLETED',
          objectsScanned,
          objectRecordsFound,
          executionsScanned,
          ...counters,
        };
        this.logger.info('Processing check finished', {
          problemCount: monitorRun.problemCount, regularCounters: monitorRun.regularCounters, esfCounters: monitorRun.esfCounters,
        });

        await persistProcessingResults(this.processingIssueRepository, results, completeness, { runId, checkedAt: monitorRunStartedAt });
        this.logger.info('ProcessingIssues persisted', { problemCount: monitorRun.problemCount });
      } else {
        monitorRun = {
          runId,
          periodFrom: period.from,
          periodTo: period.to,
          startedAt: monitorRunStartedAt.toISOString(),
          completedAt: new Date().toISOString(),
          status: 'INCOMPLETE',
          failureReason: 'TIME_LIMIT_REACHED',
          objectsScanned,
          objectRecordsFound,
          executionsScanned,
          regularCounters: EMPTY_REGULAR_COUNTERS,
          esfCounters: EMPTY_ESF_COUNTERS,
          problemCount: 0,
        };
        this.logger.warn('Monitor run incomplete: runtime budget ran out before both scans finished', completeness);
      }

      await this.monitorRunRepository.save(monitorRun);

      if (this.reportEnabled) {
        monitorRun = await this.sendReport(monitorRun, completeness, results);
      } else {
        this.logger.info('Report sending disabled by configuration, skipping');
      }

      this.logger.info('Monitor run finished', { status: monitorRun.status, durationMs: Date.now() - monitorRunStartedAt.getTime() });
      return monitorRun;
    } catch (error) {
      return this.handleUnexpectedFailure(error, { runId, period, monitorRunStartedAt, objectsScanned, objectRecordsFound, executionsScanned });
    }
  }

  private async handleUnexpectedFailure(error: unknown, context: UnexpectedFailureContext): Promise<MonitorRun> {
    this.logger.error('Monitor run failed', { error });

    let failedRun: MonitorRun = {
      runId: context.runId,
      periodFrom: context.period.from,
      periodTo: context.period.to,
      startedAt: context.monitorRunStartedAt.toISOString(),
      completedAt: new Date().toISOString(),
      status: 'FAILED',
      failureReason: error instanceof Error ? error.message : String(error),
      objectsScanned: context.objectsScanned,
      objectRecordsFound: context.objectRecordsFound,
      executionsScanned: context.executionsScanned,
      regularCounters: EMPTY_REGULAR_COUNTERS,
      esfCounters: EMPTY_ESF_COUNTERS,
      problemCount: 0,
    };

    await this.monitorRunRepository.save(failedRun);

    if (this.reportEnabled) {
      failedRun = await this.sendReport(failedRun, { objectsScanComplete: false, executionsScanComplete: false });
    }

    this.logger.info('Monitor run finished', { status: failedRun.status, durationMs: Date.now() - context.monitorRunStartedAt.getTime() });
    return failedRun;
  }

  /**
   * Sends the regular and ESF reports as two independent mails - one failing doesn't stop the
   * other. On any send failure, a COMPLETED run becomes REPORT_FAILED and is persisted again; an
   * INCOMPLETE/FAILED run keeps its own, more specific status.
   */
  private async sendReport(monitorRun: MonitorRun, completeness: ScanCompleteness, results?: ProcessingResult[]): Promise<MonitorRun> {
    const report = buildProcessingReport(monitorRun, completeness, results);
    const esfReport = buildEsfProcessingReport(monitorRun, completeness, results);

    const [regularResult, esfResult] = await Promise.allSettled([
      this.reportSender.send(report, this.reportRecipients),
      this.reportSender.sendEsf(esfReport, this.esfReportRecipients),
    ]);

    const failures = [regularResult, esfResult].filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failures.length === 0) {
      return monitorRun;
    }
    for (const failure of failures) {
      this.logger.error('Failed to send processing report', { error: failure.reason });
    }

    if (monitorRun.status !== 'COMPLETED') {
      return monitorRun;
    }
    const reportFailedRun: MonitorRun = { ...monitorRun, status: 'REPORT_FAILED' };
    await this.monitorRunRepository.save(reportFailedRun);
    return reportFailedRun;
  }
}
