import { Logger } from '@aws-lambda-powertools/logger';
import { z } from 'zod';
import { historyAfterCheckingDay } from './historyAfterCheckingDay';
import { countRunCost } from './report/countRunCost';
import { countTotals } from './report/countTotals';
import { findNotOkObjectUuids, OUTCOMES_TO_REPORT } from './report/findNotOkObjectUuids';
import { DayCheck, RunReport } from './report/RunReport';
import { ProcessingCheckResultsRepository } from './store/ProcessingCheckResultsRepository';
import { SubmissionProcessingMatcher, VersionOutcome } from '../matcher/SubmissionProcessingMatcher';
import { ObjectReader, ObjectVersion } from '../object-reader/ObjectReader';
import { CloudWatchSubmissionLogReader } from '../submission-log-reader/CloudWatchSubmissionLogReader';
import { SubmissionLogReaderDiagnostics, SubmissionLogUuidResult } from '../submission-log-reader/SubmissionLogReaderTypes';
import { amsterdamCalendarDayToAbsoluteTimeRange, amsterdamCalendarDaysFromTo, previousAmsterdamCalendarDay } from '../time-range/AmsterdamTimeRange';

// A longer period does not fit in one Lambda run, and a typo in a year should not start years of checks.
const MAX_DAYS = 31;

// The test event from the Lambda console. Both days or neither; neither means yesterday in Amsterdam.
const processingCheckEventSchema = z.object({ firstDay: z.string().date().optional(), lastDay: z.string().date().optional() })
  .refine((event) => (event.firstDay === undefined) === (event.lastDay === undefined), 'Give both firstDay and lastDay, or neither')
  .refine((event) => !event.firstDay || !event.lastDay || event.firstDay <= event.lastDay, 'firstDay is after lastDay')
  .refine((event) => !event.firstDay || !event.lastDay || amsterdamCalendarDaysFromTo(event.firstDay, event.lastDay).length <= MAX_DAYS,
    `The period is at most ${MAX_DAYS} days`);

export type ProcessingCheckEvent = z.infer<typeof processingCheckEventSchema>;

export interface ProcessingCheckOptions {
  resultsRepository: ProcessingCheckResultsRepository;
  // Passed to the log reader; also fills the cost block of the report.
  diagnostics: boolean;
  logger?: Logger;
}

export interface ProcessingCheckRun {
  event: ProcessingCheckEvent;
  // The Lambda request id.
  runId: string;
  // context.getRemainingTimeInMillis of the Lambda, checked before each new objectUuid.
  getRemainingTimeInMillis: () => number;
}

// The run stops before a new objectUuid or day when less time is left. The reads that already run (each up to two queries of 30 seconds),
// saving the histories of the day and the report must still fit.
const MIN_REMAINING_MS = 3 * 60 * 1000;

interface LogsOfDay {
  logs: SubmissionLogUuidResult[];
  objectUuidsWithUnreadLogs: string[];
  // Read or failed; after OUT_OF_TIME the rest of the day is in neither.
  readObjectUuids: string[];
  outOfTime: boolean;
  durationMs: number;
}

interface DayResult {
  dayCheck: DayCheck;
  versionOutcomes: VersionOutcome[];
  diagnostics: SubmissionLogReaderDiagnostics[];
  logReadMs: number;
  outOfTime: boolean;
}

/**
 * Checks per Amsterdam day of a period whether the submissions were processed, and stores the outcomes in DynamoDB.
 *
 * The object reader finds the versions of the whole period at once. Then per day the log reader reads the logs per objectUuid (from the
 * start of that day until now), and the matcher decides the outcome per version. The processing history of each submission is updated, and
 * the run report (PK RUN) records per day COMPLETE or INCOMPLETE.
 * Only looks; it changes nothing in the Objects API and restarts nothing.
 *
 * @example
 * const check = new ProcessingCheck({
 *   resultsRepository: new ProcessingCheckResultsRepository({ tableName: process.env.TABLE_NAME! }),
 *   diagnostics: true,
 * });
 * const report = await check.run({
 *   event: { firstDay: '2026-11-16', lastDay: '2026-11-18' },
 *   runId: context.awsRequestId,
 *   getRemainingTimeInMillis: () => context.getRemainingTimeInMillis(),
 * });
 */
export class ProcessingCheck {
  private readonly resultsRepository: ProcessingCheckResultsRepository;
  private readonly diagnostics: boolean;
  private readonly logger: Logger;
  private readonly objectReader: ObjectReader;
  private readonly logReader: CloudWatchSubmissionLogReader;
  private readonly matcher: SubmissionProcessingMatcher;

  constructor(options: ProcessingCheckOptions) {
    this.resultsRepository = options.resultsRepository;
    this.diagnostics = options.diagnostics;
    this.logger = options.logger ? options.logger.createChild() : new Logger({ serviceName: 'ProcessingCheck' });
    this.objectReader = new ObjectReader({ logger: this.logger });
    this.logReader = new CloudWatchSubmissionLogReader({ diagnostics: options.diagnostics, logger: this.logger });
    this.matcher = new SubmissionProcessingMatcher();
  }

  /**
   * @param run The event with the period, the runId and the remaining Lambda time.
   * @returns The stored report of the run. Throws before writing anything when the period is invalid, and when storing fails.
   */
  async run(run: ProcessingCheckRun): Promise<RunReport> {
    const days = daysToCheck(run.event);
    const runStartedAt = Date.now();
    const report = startedReport(run.runId, days, runStartedAt);
    this.logger.info('Processing check started', { runId: run.runId, firstDay: report.firstDay, lastDay: report.lastDay, days: days.length });
    await this.resultsRepository.putReport(report);

    const objectReadStartedAt = Date.now();
    const versionsOfPeriod = await this.findVersionsOfPeriod(report, run.runId);
    const objectReadMs = Date.now() - objectReadStartedAt;

    const checkedDays = await this.checkDays(days, versionsOfPeriod, report, run);

    this.addTotalsToReport(report, checkedDays, objectReadMs, runStartedAt);
    await this.resultsRepository.putReport(report);
    this.logger.info('Processing check finished', {
      runId: run.runId,
      status: report.status,
      days: report.days,
      totals: report.totals,
      notOkObjects: report.notOkObjectUuids.length,
      cost: report.cost,
    });
    return report;
  }

  // Checks the days one after the other and saves the report after each day, so a later failure keeps the earlier days.
  private async checkDays(days: string[], versionsOfPeriod: ObjectVersion[] | undefined, report: RunReport, run: ProcessingCheckRun) {
    const checkedDays: DayResult[] = [];
    let outOfTime = false;
    for (const day of days) {
      if (!versionsOfPeriod) {
        report.days.push({ day, status: 'INCOMPLETE', reason: 'OBJECTS_API_FAILED' });
        continue;
      }
      if (outOfTime || run.getRemainingTimeInMillis() < MIN_REMAINING_MS) {
        outOfTime = true;
        this.logger.info('Day skipped, out of time', { runId: run.runId, day });
        report.days.push({ day, status: 'INCOMPLETE', reason: 'OUT_OF_TIME' });
        continue;
      }

      const versionsOfDay = versionsOfPeriod.filter((version) => version.registrationAt === day);
      const dayResult = await this.checkDay(day, versionsOfDay, run);
      checkedDays.push(dayResult);
      report.days.push(dayResult.dayCheck);
      outOfTime = dayResult.outOfTime;
      await this.resultsRepository.putReport(report);
    }
    return checkedDays;
  }

  private addTotalsToReport(report: RunReport, checkedDays: DayResult[], objectReadMs: number, runStartedAt: number) {
    const versionOutcomes = checkedDays.flatMap((checkedDay) => checkedDay.versionOutcomes);
    report.status = report.days.every((dayCheck) => dayCheck.status === 'COMPLETE') ? 'COMPLETE' : 'INCOMPLETE';
    report.totals = countTotals(versionOutcomes);
    report.notOkObjectUuids = findNotOkObjectUuids(versionOutcomes);
    if (this.diagnostics) {
      let logReadMs = 0;
      for (const checkedDay of checkedDays) {
        logReadMs += checkedDay.logReadMs;
      }
      const diagnostics = checkedDays.flatMap((checkedDay) => checkedDay.diagnostics);
      report.cost = countRunCost({ diagnostics, objectReadMs, logReadMs, durationMs: Date.now() - runStartedAt });
    }
    report.finishedAt = new Date().toISOString();
  }

  // One read for the whole period: reading per day would list the newer Objects and their histories again for every day.
  // undefined when the Objects API failed; then every day is OBJECTS_API_FAILED.
  private async findVersionsOfPeriod(report: RunReport, runId: string): Promise<ObjectVersion[] | undefined> {
    try {
      return await this.objectReader.findVersions({ firstDay: report.firstDay, lastDay: report.lastDay });
    } catch (error) {
      this.logger.error('Objects API read failed', { runId, error });
      return undefined;
    }
  }

  private async checkDay(day: string, versions: ObjectVersion[], run: ProcessingCheckRun): Promise<DayResult> {
    const dayStartedAt = Date.now();
    this.logger.info('Day check started', { runId: run.runId, day, versions: versions.length });

    const objectUuids = [...new Set(versions.map((version) => version.objectUuid))];
    const logsOfDay = await this.readLogsOfDay(day, objectUuids, run);
    const outcomes = this.findOutcomesOfReadObjects(versions, logsOfDay);
    this.logVersionsNotOk(outcomes.versions, run.runId);

    this.logger.info('Saving histories', { runId: run.runId, day, objects: logsOfDay.readObjectUuids.length });
    await this.updateSubmissionHistories(day, outcomes.versions, run.runId);

    const dayCheck = dayCheckAfterLogReads(day, logsOfDay);
    const diagnostics = logsOfDay.logs.map((logs) => logs.diagnostics).filter((logDiagnostics) => logDiagnostics !== undefined);
    const durationMs = Date.now() - dayStartedAt;
    this.logger.info('Day check finished', {
      runId: run.runId,
      day,
      status: dayCheck.status,
      reason: dayCheck.reason,
      objects: objectUuids.length,
      versions: versions.length,
      totals: countTotals(outcomes.versions),
      logsRead: logsOfDay.logs.length,
      logsNotRead: logsOfDay.objectUuidsWithUnreadLogs.length,
      objectsNotChecked: objectUuids.length - logsOfDay.readObjectUuids.length,
      tracesWithoutVersion: outcomes.tracesWithoutVersion.length,
      durationMs,
      cost: this.diagnostics ? countRunCost({ diagnostics, objectReadMs: 0, logReadMs: logsOfDay.durationMs, durationMs }) : undefined,
    });

    return { dayCheck, versionOutcomes: outcomes.versions, diagnostics, logReadMs: logsOfDay.durationMs, outOfTime: logsOfDay.outOfTime };
  }

  // From the start of the day until now, so the logs of an execution that ran after the day are included.
  private async readLogsOfDay(day: string, objectUuids: string[], run: ProcessingCheckRun): Promise<LogsOfDay> {
    const startedAt = Date.now();
    const reads = await this.logReader.findByObjectUuids({
      objectUuids,
      range: { fromInclusive: amsterdamCalendarDayToAbsoluteTimeRange(day).fromInclusive, toExclusive: new Date() },
      shouldStop: () => run.getRemainingTimeInMillis() < MIN_REMAINING_MS,
    });
    const objectUuidsWithUnreadLogs = reads.failedReads.map((failedRead) => failedRead.objectUuid);
    const readObjectUuids = [...objectUuidsWithUnreadLogs, ...reads.logs.map((logs) => logs.lookup.objectUuid)];
    if (reads.stopped) {
      this.logger.warn('Out of time, the rest of the day is not checked', {
        runId: run.runId,
        day,
        objectsNotChecked: objectUuids.length - readObjectUuids.length,
        remainingTimeInMillis: run.getRemainingTimeInMillis(),
      });
    }
    return { logs: reads.logs, objectUuidsWithUnreadLogs, readObjectUuids, outOfTime: reads.stopped, durationMs: Date.now() - startedAt };
  }

  // After OUT_OF_TIME only the objectUuids that were read go to the matcher. The others are not checked, so they are not LOGS_NOT_READ either.
  private findOutcomesOfReadObjects(versions: ObjectVersion[], logsOfDay: LogsOfDay) {
    return this.matcher.findOutcomes({
      versions: versions.filter((version) => logsOfDay.readObjectUuids.includes(version.objectUuid)),
      logs: logsOfDay.logs,
      objectUuidsWithUnreadLogs: logsOfDay.objectUuidsWithUnreadLogs,
    });
  }

  private logVersionsNotOk(versionOutcomes: VersionOutcome[], runId: string) {
    for (const versionOutcome of versionOutcomes) {
      if (OUTCOMES_TO_REPORT.includes(versionOutcome.outcome)) {
        this.logger.debug('Version not ok', {
          runId,
          objectUuid: versionOutcome.version.objectUuid,
          index: versionOutcome.version.index,
          outcome: versionOutcome.outcome,
          reason: versionOutcome.reason,
        });
      }
    }
  }

  private async updateSubmissionHistories(day: string, versionOutcomes: VersionOutcome[], runId: string) {
    const outcomesByObjectUuid = new Map<string, VersionOutcome[]>();
    for (const versionOutcome of versionOutcomes) {
      const objectUuid = versionOutcome.version.objectUuid;
      const outcomesOfObject = outcomesByObjectUuid.get(objectUuid) ?? [];
      outcomesOfObject.push(versionOutcome);
      outcomesByObjectUuid.set(objectUuid, outcomesOfObject);
    }

    const checkedAt = new Date().toISOString();
    for (const [objectUuid, outcomesOfObject] of outcomesByObjectUuid) {
      const existingHistory = await this.resultsRepository.getSubmissionHistory(objectUuid);
      const history = historyAfterCheckingDay({ existingHistory, day, versionOutcomes: outcomesOfObject, checkedAt, runId });
      await this.resultsRepository.putSubmissionHistory(history);
    }
  }
}

function dayCheckAfterLogReads(day: string, logsOfDay: LogsOfDay): DayCheck {
  if (logsOfDay.outOfTime) {
    return { day, status: 'INCOMPLETE', reason: 'OUT_OF_TIME' };
  }
  if (logsOfDay.objectUuidsWithUnreadLogs.length > 0) {
    return { day, status: 'INCOMPLETE', reason: 'LOGS_NOT_READ' };
  }
  return { day, status: 'COMPLETE' };
}

function daysToCheck(event: ProcessingCheckEvent): string[] {
  const validEvent = processingCheckEventSchema.parse(event);
  const yesterday = previousAmsterdamCalendarDay();
  return amsterdamCalendarDaysFromTo(validEvent.firstDay ?? yesterday, validEvent.lastDay ?? yesterday);
}

function startedReport(runId: string, days: string[], runStartedAt: number): RunReport {
  return {
    runId,
    firstDay: days[0],
    lastDay: days[days.length - 1],
    status: 'RUNNING',
    startedAt: new Date(runStartedAt).toISOString(),
    days: [],
    totals: {},
    notOkObjectUuids: [],
  };
}
