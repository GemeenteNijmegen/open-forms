import { CloudWatchLogsClient, GetQueryResultsCommand, QueryStatistics, ResultField, StartQueryCommand, StopQueryCommand } from '@aws-sdk/client-cloudwatch-logs';
import { CloudWatchSubmissionLogReaderError, CloudWatchSubmissionLogReaderStage } from '../errors/CloudWatchSubmissionLogReaderError';
import { AbsoluteTimeRange } from '../SubmissionLogReaderTypes';

const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 30_000;

// The documented ceiling for a single paginated Logs Insights QL query, see StartQuery's limit.
const CWLI_MAX_RESULTS = 100_000;

export interface CwliQueryRequest {
  queryString: string;
  range: AbsoluteTimeRange;

  // Only used to label errors thrown for this query; the query itself already selects its own log groups.
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

  // How often to call GetQueryResults while a query is still Running/Scheduled.
  pollIntervalMs?: number;

  /**
   * Local giveup point, separate from CWLI's own 60-minute server-side query timeout. Exceeding
   * it calls StopQuery and throws QUERY_TIMEOUT, so a stuck query never hangs the reader.
   */
  timeoutMs?: number;
}

/**
 * Runs a single CWLI query to completion: StartQuery, poll GetQueryResults until a terminal
 * status, then follow nextToken to collect every result page. Only a Complete status is
 * accepted as a normal result; every other outcome becomes a CloudWatchSubmissionLogReaderError
 * so the caller never receives a silently partial result.
 *
 * The query string is built by the caller (it already contains SOURCE logGroupTags(...), field
 * selection, filters, and sort order); this class only knows how to execute one.
 */
export class CloudWatchLogsQueryRunner {
  private readonly cloudWatchLogsClient: CloudWatchLogsClient;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;

  constructor(options: CloudWatchLogsQueryRunnerOptions = {}) {
    this.cloudWatchLogsClient = options.cloudWatchLogsClient ?? new CloudWatchLogsClient({});
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async run(request: CwliQueryRequest): Promise<CwliQueryResult> {
    const queryId = await this.startQuery(request);
    const deadline = Date.now() + this.timeoutMs;

    while (true) {
      const response = await this.getQueryResults(queryId, request);

      if (response.status === 'Complete') {
        const rows = await this.collectRemainingPages(queryId, request, this.toRows(response.results), response.nextToken);

        if (rows.length >= (request.limit ?? CWLI_MAX_RESULTS)) {
          throw new CloudWatchSubmissionLogReaderError(
            'QUERY_RESULT_LIMIT_REACHED',
            `CWLI query returned ${rows.length} rows, at or above the ${request.limit ?? CWLI_MAX_RESULTS} result limit; results may be truncated`,
            { stage: request.stage, queryId, queryStatus: response.status, queryRange: request.range, statistics: response.statistics },
          );
        }

        return { rows, queryId, statistics: response.statistics };
      }

      if (response.status === 'Failed' || response.status === 'Cancelled' || response.status === 'Timeout') {
        const codeByStatus = { Failed: 'QUERY_FAILED', Cancelled: 'QUERY_CANCELLED', Timeout: 'QUERY_TIMEOUT' } as const;
        throw new CloudWatchSubmissionLogReaderError(
          codeByStatus[response.status],
          `CWLI query ended with status ${response.status}`,
          { stage: request.stage, queryId, queryStatus: response.status, queryRange: request.range, statistics: response.statistics },
        );
      }

      // Running, Scheduled or Unknown: keep polling until the local deadline passes.
      if (Date.now() >= deadline) {
        // Makes sure the query stops in the background
        await this.stopQuerySilently(queryId);
        throw new CloudWatchSubmissionLogReaderError(
          'QUERY_TIMEOUT',
          `CWLI query did not reach a terminal status within the local timeout of ${this.timeoutMs}ms`,
          { stage: request.stage, queryId, queryStatus: response.status, queryRange: request.range },
        );
      }

      await sleep(this.pollIntervalMs);
    }
  }

  private async startQuery(request: CwliQueryRequest): Promise<string> {
    let response;
    try {
      response = await this.cloudWatchLogsClient.send(new StartQueryCommand({
        queryString: request.queryString,
        startTime: toEpochSecondsInclusiveStart(request.range.fromInclusive),
        endTime: toEpochSecondsInclusiveEnd(request.range.toExclusive),
        limit: request.limit,
      }));
    } catch (cause) {
      throw new CloudWatchSubmissionLogReaderError(
        'QUERY_START_FAILED',
        'StartQuery failed',
        { stage: request.stage, queryRange: request.range, awsRequestId: awsRequestIdOf(cause) },
        { cause },
      );
    }

    if (!response.queryId) {
      throw new CloudWatchSubmissionLogReaderError(
        'QUERY_START_FAILED',
        'StartQuery succeeded but returned no queryId',
        { stage: request.stage, queryRange: request.range, awsRequestId: response.$metadata?.requestId },
      );
    }

    return response.queryId;
  }

  private async getQueryResults(queryId: string, request: CwliQueryRequest, nextToken?: string) {
    try {
      return await this.cloudWatchLogsClient.send(new GetQueryResultsCommand({ queryId, nextToken }));
    } catch (cause) {
      throw new CloudWatchSubmissionLogReaderError(
        'QUERY_RESULTS_FAILED',
        'GetQueryResults failed',
        { stage: request.stage, queryId, queryRange: request.range, awsRequestId: awsRequestIdOf(cause) },
        { cause },
      );
    }
  }

  // nextToken after a Complete status means there are more result pages; a failure here means we can't vouch for completeness, so we never return the partial rows we already have.
  private async collectRemainingPages(
    queryId: string,
    request: CwliQueryRequest,
    rows: Record<string, string>[],
    nextToken: string | undefined,
  ): Promise<Record<string, string>[]> {
    let allRows = rows;
    let token = nextToken;

    while (token) {
      let response;
      try {
        response = await this.cloudWatchLogsClient.send(new GetQueryResultsCommand({ queryId, nextToken: token }));
      } catch (cause) {
        throw new CloudWatchSubmissionLogReaderError(
          'QUERY_RESULTS_INCOMPLETE',
          `Fetched ${allRows.length} rows before pagination failed; refusing to return a partial result`,
          { stage: request.stage, queryId, queryRange: request.range, awsRequestId: awsRequestIdOf(cause) },
          { cause },
        );
      }

      allRows = allRows.concat(this.toRows(response.results));
      token = response.nextToken;
    }

    return allRows;
  }

  private toRows(results: ResultField[][] | undefined): Record<string, string>[] {
    return (results ?? []).map(fields => {
      const row: Record<string, string> = {};
      for (const field of fields) {
        if (field.field !== undefined && field.value !== undefined) {
          row[field.field] = field.value;
        }
      }
      return row;
    });
  }

  private async stopQuerySilently(queryId: string): Promise<void> {
    try {
      await this.cloudWatchLogsClient.send(new StopQueryCommand({ queryId }));
    } catch {
      // Best-effort cleanup: the QUERY_TIMEOUT error we throw right after this matters more than StopQuery succeeding.
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toEpochSecondsInclusiveStart(fromInclusive: Date): number {
  return Math.floor(fromInclusive.getTime() / 1000);
}

// CWLI's endTime is inclusive and second-grained, so the half-open toExclusive becomes "the last whole second before it".
function toEpochSecondsInclusiveEnd(toExclusive: Date): number {
  return Math.ceil(toExclusive.getTime() / 1000) - 1;
}

function awsRequestIdOf(cause: unknown): string | undefined {
  return (cause as { $metadata?: { requestId?: string } } | undefined)?.$metadata?.requestId;
}
