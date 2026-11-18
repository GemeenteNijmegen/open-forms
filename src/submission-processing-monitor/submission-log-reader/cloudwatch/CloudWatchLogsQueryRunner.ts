import { setTimeout as sleep } from 'node:timers/promises';
import {
  CloudWatchLogsClient, CloudWatchLogsServiceException, GetQueryResultsCommand, QueryStatistics, ResultField, StartQueryCommand, StopQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { CloudWatchSubmissionLogReaderError, CloudWatchSubmissionLogReaderStage } from '../errors/CloudWatchSubmissionLogReaderError';
import { AbsoluteTimeRange } from '../SubmissionLogReaderTypes';

// Maximum for a Logs Insights QL query. Always sent to StartQuery, so the limit check uses the same number as CloudWatch.
const CWLI_MAX_RESULTS = 100_000;

export interface CwliQueryRequest {
  queryString: string;
  range: AbsoluteTimeRange;

  // Only labels errors. The query string selects its own log groups.
  stage: CloudWatchSubmissionLogReaderStage;

  limit?: number;
}

export interface CwliQueryResult {
  rows: Record<string, string>[];
  queryId: string;
  statistics?: QueryStatistics;
}

export interface CloudWatchLogsQueryRunnerOptions {
  cloudWatchLogsClient?: CloudWatchLogsClient;
  pollIntervalMs?: number;

  // Local deadline, separate from the 60 minutes CloudWatch allows. Passing it stops the query.
  timeoutMs?: number;
}

/**
 * Runs one CWLI query: start it, poll until it is done, then fetch every result page.
 * Anything other than a complete result throws a CloudWatchSubmissionLogReaderError.
 */
export class CloudWatchLogsQueryRunner {
  private readonly cloudWatchLogsClient: CloudWatchLogsClient;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;

  constructor(options: CloudWatchLogsQueryRunnerOptions = {}) {
    this.cloudWatchLogsClient = options.cloudWatchLogsClient ?? new CloudWatchLogsClient({});
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async run(request: CwliQueryRequest): Promise<CwliQueryResult> {
    const limit = request.limit ?? CWLI_MAX_RESULTS;
    const queryId = await this.startQuery(request, limit);
    const context = { stage: request.stage, queryId, queryRange: request.range };
    const deadline = Date.now() + this.timeoutMs;

    let page = await this.getPage(queryId, request, undefined, 'QUERY_FAILED');
    while (page.status !== 'Complete') {
      if (page.status === 'Failed' || page.status === 'Cancelled' || page.status === 'Timeout') {
        throw new CloudWatchSubmissionLogReaderError('QUERY_FAILED', `CWLI query ended with status ${page.status}`,
          { ...context, queryStatus: page.status, statistics: page.statistics });
      }
      if (Date.now() >= deadline) {
        await this.stopQuery(queryId);
        throw new CloudWatchSubmissionLogReaderError('QUERY_FAILED', `CWLI query still ${page.status} after ${this.timeoutMs}ms`,
          { ...context, queryStatus: page.status });
      }
      await sleep(this.pollIntervalMs);
      page = await this.getPage(queryId, request, undefined, 'QUERY_FAILED');
    }

    const rows = toRows(page.results);
    let nextToken = page.nextToken;
    while (nextToken) {
      const nextPage = await this.getPage(queryId, request, nextToken, 'QUERY_RESULTS_INCOMPLETE');
      rows.push(...toRows(nextPage.results));
      nextToken = nextPage.nextToken;
    }

    // CloudWatch does not say when it cuts off results, so reaching the limit counts as possibly incomplete.
    if (rows.length >= limit) {
      throw new CloudWatchSubmissionLogReaderError('QUERY_RESULTS_INCOMPLETE', `CWLI query returned ${rows.length} rows, the limit is ${limit}`,
        { ...context, queryStatus: page.status, statistics: page.statistics });
    }

    return { rows, queryId, statistics: page.statistics };
  }

  private async startQuery(request: CwliQueryRequest, limit: number): Promise<string> {
    try {
      const response = await this.cloudWatchLogsClient.send(new StartQueryCommand({
        queryString: request.queryString,
        startTime: Math.floor(request.range.fromInclusive.getTime() / 1000),
        // endTime is in whole seconds and includes that whole second, so it is the last second before toExclusive.
        endTime: Math.ceil(request.range.toExclusive.getTime() / 1000) - 1,
        limit,
      }));
      if (!response.queryId) {
        throw new Error('StartQuery returned no queryId');
      }
      return response.queryId;
    } catch (cause) {
      throw new CloudWatchSubmissionLogReaderError('QUERY_FAILED', 'StartQuery failed',
        { stage: request.stage, queryRange: request.range, awsRequestId: awsRequestIdOf(cause) }, { cause });
    }
  }

  private async getPage(
    queryId: string, request: CwliQueryRequest, nextToken: string | undefined, failureCode: 'QUERY_FAILED' | 'QUERY_RESULTS_INCOMPLETE',
  ) {
    try {
      return await this.cloudWatchLogsClient.send(new GetQueryResultsCommand({ queryId, nextToken }));
    } catch (cause) {
      throw new CloudWatchSubmissionLogReaderError(failureCode, 'GetQueryResults failed',
        { stage: request.stage, queryId, queryRange: request.range, awsRequestId: awsRequestIdOf(cause) }, { cause });
    }
  }

  // The QUERY_FAILED thrown right after matters more than whether StopQuery itself works.
  private async stopQuery(queryId: string): Promise<void> {
    try {
      await this.cloudWatchLogsClient.send(new StopQueryCommand({ queryId }));
    } catch {
      return;
    }
  }
}

function toRows(results: ResultField[][] | undefined): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (const fields of results ?? []) {
    const row: Record<string, string> = {};
    for (const field of fields) {
      if (field.field !== undefined && field.value !== undefined) {
        row[field.field] = field.value;
      }
    }
    rows.push(row);
  }
  return rows;
}

function awsRequestIdOf(cause: unknown): string | undefined {
  return cause instanceof CloudWatchLogsServiceException ? cause.$metadata.requestId : undefined;
}
