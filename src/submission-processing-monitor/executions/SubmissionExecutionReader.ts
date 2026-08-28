import { Logger } from '@aws-lambda-powertools/logger';
import { DescribeExecutionCommand, ListExecutionsCommand, SFNClient } from '@aws-sdk/client-sfn';
import type { MatchableExecution } from './ExecutionMatcher';
import { amsterdamMidnightUtc, ProcessingPeriod } from '../model/ProcessingPeriod';
import { RuntimeBudget } from '../RuntimeBudget';

const DEFAULT_DESCRIBE_EXECUTION_CONCURRENCY = 5;

export interface SubmissionExecution {
  executionArn: string;
  name: string;
  status: string;
  startDate: Date;
  stopDate?: Date;
}

export interface SubmissionExecutionsPage {
  executions: SubmissionExecution[];
  nextToken?: string;
}

export interface ExecutionDetails {
  objectUuid?: string;
  reference?: string;
  /** Only set when the execution failed. Can contain task-level detail, treat like any other error detail before logging it. */
  error?: string;
  cause?: string;
  /** NOT_REDRIVABLE, REDRIVABLE or REDRIVABLE_BY_MAP_RUN. Undefined if Step Functions doesn't report a redrive status for this execution. */
  redriveStatus?: string;
  redriveCount?: number;
  redriveDate?: Date;
}

export interface SubmissionExecutionScanResult {
  executions: SubmissionExecution[];
  /** False when the runtime budget ran out before every relevant page was read. */
  complete: boolean;
}

export interface MatchableExecutionScanResult {
  executions: MatchableExecution[];
  complete: boolean;
}

/**
 * Read-only reader for the existing submission-forwarder Step Function. Only lists and describes
 * executions, never starts, stops or redrives them - that stays the receiver/resubmit lambda's job.
 */
export class SubmissionExecutionReader {
  private readonly client: SFNClient;
  private readonly logger: Logger;
  private readonly describeExecutionConcurrency: number;

  constructor(private readonly stateMachineArn: string, options: { logger?: Logger; describeExecutionConcurrency?: number } = {}) {
    this.client = new SFNClient();
    this.logger = options.logger ?? new Logger({ serviceName: 'SubmissionExecutionReader' });
    this.describeExecutionConcurrency = options.describeExecutionConcurrency ?? DEFAULT_DESCRIBE_EXECUTION_CONCURRENCY;
  }

  async listExecutionsPage(nextToken?: string): Promise<SubmissionExecutionsPage> {
    const response = await this.client.send(new ListExecutionsCommand({
      stateMachineArn: this.stateMachineArn,
      nextToken,
    }));

    const executions: SubmissionExecution[] = (response.executions ?? [])
      .filter(execution => execution.executionArn && execution.name && execution.status && execution.startDate)
      .map(execution => ({
        executionArn: execution.executionArn as string,
        name: execution.name as string,
        status: execution.status as string,
        startDate: execution.startDate as Date,
        stopDate: execution.stopDate,
      }));

    this.logger.debug('Listed submission-forwarder executions page', {
      count: executions.length,
      hasNextToken: Boolean(response.nextToken),
    });
    return { executions, nextToken: response.nextToken };
  }

  /**
   * Lists every execution from the start of period up to monitorRunStartedAt - not period.to.
   * An object registered just before period.to can have its execution start seconds later,
   * already past period.to, so period.to is not a valid upper bound for executions. ListExecutions
   * returns executions newest-startDate-first (documented AWS behaviour), so once a page's
   * execution is provably older than period.from, every execution after it is too and paging
   * can stop.
   */
  async listExecutionsInPeriod(
    period: ProcessingPeriod,
    monitorRunStartedAt: Date,
    runtimeBudget?: RuntimeBudget,
  ): Promise<SubmissionExecutionScanResult> {
    const fromInstant = amsterdamMidnightUtc(period.from);
    const results: SubmissionExecution[] = [];
    let nextToken: string | undefined;
    let pagesFetched = 0;
    let complete = true;

    do {
      if (runtimeBudget && !runtimeBudget.hasTimeRemaining()) {
        complete = false;
        this.logger.debug('Execution list scan stopped: runtime budget exhausted', { pagesFetched, executionsFoundSoFar: results.length, remainingMs: runtimeBudget.remainingMs() });
        break;
      }
      const pageResult = await this.listExecutionsPage(nextToken);
      pagesFetched += 1;

      let reachedOlderThanPeriod = false;
      for (const execution of pageResult.executions) {
        if (execution.startDate < fromInstant) {
          reachedOlderThanPeriod = true;
          break;
        }
        if (execution.startDate <= monitorRunStartedAt) {
          results.push(execution);
        }
      }

      if (reachedOlderThanPeriod) {
        break;
      }
      nextToken = pageResult.nextToken;
    } while (nextToken);

    this.logger.debug('Listed submission-forwarder executions in period', { period, monitorRunStartedAt, pagesFetched, executionsFound: results.length, complete });
    return { executions: results, complete };
  }

  /**
   * Combines listExecutionsInPeriod with a describeExecution call per execution, for matching
   * against object records. DescribeExecution calls run in small concurrent batches rather than
   * one unbounded Promise.all, with a runtime check before each batch.
   */
  async listExecutionsWithMetadata(
    period: ProcessingPeriod,
    monitorRunStartedAt: Date,
    runtimeBudget?: RuntimeBudget,
  ): Promise<MatchableExecutionScanResult> {
    const listResult = await this.listExecutionsInPeriod(period, monitorRunStartedAt, runtimeBudget);
    const withMetadata: MatchableExecution[] = [];
    let complete = listResult.complete;

    for (let i = 0; i < listResult.executions.length; i += this.describeExecutionConcurrency) {
      if (!complete) {
        break;
      }
      if (runtimeBudget && !runtimeBudget.hasTimeRemaining()) {
        complete = false;
        this.logger.debug('DescribeExecution scan stopped: runtime budget exhausted', { describedSoFar: withMetadata.length, totalExecutions: listResult.executions.length, remainingMs: runtimeBudget.remainingMs() });
        break;
      }
      const batch = listResult.executions.slice(i, i + this.describeExecutionConcurrency);
      const detailsBatch = await Promise.all(batch.map(execution => this.describeExecution(execution.executionArn)));
      batch.forEach((execution, index) => withMetadata.push({ ...execution, objectUuid: detailsBatch[index].objectUuid }));
      this.logger.debug('DescribeExecution batch completed', { batchSize: batch.length, describedSoFar: withMetadata.length, totalExecutions: listResult.executions.length });
    }

    this.logger.info('Listed submission-forwarder executions with metadata', { executionsFound: withMetadata.length, complete });
    return { executions: withMetadata, complete };
  }

  /**
   * Reads objectUuid/reference from the execution input (never the full input or output), plus
   * failure and redrive details. error/cause come straight from Step Functions and are only ever
   * present on a failed execution - the caller decides whether/how much of them to log, this
   * reader doesn't strip or truncate them itself.
   */
  async describeExecution(executionArn: string): Promise<ExecutionDetails> {
    const response = await this.client.send(new DescribeExecutionCommand({ executionArn }));

    const details: ExecutionDetails = {
      error: response.error,
      cause: response.cause,
      redriveStatus: response.redriveStatus,
      redriveCount: response.redriveCount,
      redriveDate: response.redriveDate,
    };
    if (!response.input) {
      return details;
    }

    const parsed = JSON.parse(response.input) as { objectUUID?: unknown; reference?: unknown };
    return {
      ...details,
      objectUuid: typeof parsed.objectUUID === 'string' ? parsed.objectUUID : undefined,
      reference: typeof parsed.reference === 'string' ? parsed.reference : undefined,
    };
  }
}
