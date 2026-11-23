import { Logger } from '@aws-lambda-powertools/logger';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { CloudWatchLogsQueryRunner, CwliQueryResult } from './cloudwatch/CloudWatchLogsQueryRunner';
import { CloudWatchSubmissionLogReaderError } from './errors/CloudWatchSubmissionLogReaderError';
import { buildExecutionQuery } from './queries/SubmissionExecutionCwliQuery';
import { buildReceiverQuery } from './queries/SubmissionReceiverCwliQuery';
import {
  AbsoluteTimeRange, FindSubmissionLogsByUuidOptions, FindSubmissionLogsByUuidsOptions, FindSubmissionLogsByVersionOptions,
  SubmissionLogReaderDiagnostics, SubmissionLogTrace, SubmissionLogUuidResult, SubmissionLogUuidsResult, SubmissionLogVersionResult,
} from './SubmissionLogReaderTypes';
import {
  attachExecutions, buildReceiverTraces, categorizeTracesByObjectIndex, collectExecutionArns, groupReceiverRowsByObjectUuid,
} from './traces/SubmissionTraceBuilder';

// An execution started just before toExclusive can log its last events after it. The orchestrator has no Wait states; its slowest
// Lambdas time out at 5 minutes with 3 retries per task, so one hour covers a full execution.
const EXECUTION_QUERY_EXTRA_MS = 60 * 60 * 1000;

// findByObjectUuids looks for this many objectUuids in one query. A query scans the same log data for 1 or 25 objectUuids, so a group is
// much faster and cheaper than 25 queries. A query returns at most 10,000 rows; a group that gets more is split.
const OBJECTS_PER_QUERY = 25;

// StartQuery and GetQueryResults may each be called 10 times per second per account, shared with the console and other users. Each group
// polls once per second, so 6 groups at the same time stay around 5 calls per second.
const GROUPS_AT_THE_SAME_TIME = 6;

interface LogsOfObjects {
  logs: SubmissionLogUuidResult[];
  diagnostics?: SubmissionLogReaderDiagnostics;
}

export interface CloudWatchSubmissionLogReaderOptions {
  cloudWatchLogsClient?: CloudWatchLogsClient;

  // Adds the queryId and CloudWatch statistics of each query to the result. Functional code must not depend on it.
  diagnostics?: boolean;

  logger?: Logger;
}

export class CloudWatchSubmissionLogReader {
  private readonly diagnostics: boolean;
  private readonly queryRunner: CloudWatchLogsQueryRunner;
  private readonly logger: Logger;

  constructor(options: CloudWatchSubmissionLogReaderOptions = {}) {
    this.diagnostics = options.diagnostics ?? false;
    this.logger = options.logger ? options.logger.createChild() : new Logger({ serviceName: 'CloudWatchSubmissionLogReader' });
    this.queryRunner = new CloudWatchLogsQueryRunner({ cloudWatchLogsClient: options.cloudWatchLogsClient });
  }

  /**
   * Finds every receiver trace (one per correlation_id) for an object UUID, with the Step Functions events of its executions.
   * The reader returns what it found and draws no conclusions.
   *
   * @param options The object UUID and the absolute time range to search.
   * @returns The traces found. An empty array means CloudWatch had nothing in the range.
   * @throws CloudWatchSubmissionLogReaderError when the range is invalid or the CloudWatch read is not reliable.
   * @example
   * import { CloudWatchSubmissionLogReader } from './CloudWatchSubmissionLogReader';
   * import { amsterdamCalendarDayToAbsoluteTimeRange } from '../time-range/AmsterdamTimeRange';
   *
   * const reader = new CloudWatchSubmissionLogReader();
   * const range = amsterdamCalendarDayToAbsoluteTimeRange('2026-11-02');
   * const { traces } = await reader.findByObjectUuid({ objectUuid, range });
   */
  async findByObjectUuid(options: FindSubmissionLogsByUuidOptions): Promise<SubmissionLogUuidResult> {
    const found = await this.findLogsOfObjects([options.objectUuid], options.range);
    const result = found.logs[0];
    if (found.diagnostics) {
      result.diagnostics = found.diagnostics;
    }
    return result;
  }

  /**
   * Reads the logs of several object UUIDs, in groups of 25 per query and six groups at the same time. A group that fails is read again in
   * halves (too many rows) or one by one, so only an objectUuid whose logs really cannot be read ends up in failedReads.
   *
   * @param options The object UUIDs, the range, and shouldStop, which is checked before each group and before each read one by one.
   * @returns The logs that were read, the reads that threw, the diagnostics per query, and whether shouldStop ended the reads early.
   * @example
   * const reads = await reader.findByObjectUuids({ objectUuids, range, shouldStop: () => context.getRemainingTimeInMillis() < 180_000 });
   */
  async findByObjectUuids(options: FindSubmissionLogsByUuidsOptions): Promise<SubmissionLogUuidsResult> {
    const startedAt = Date.now();
    const total = options.objectUuids.length;
    const groups = splitIntoGroups(options.objectUuids, OBJECTS_PER_QUERY);
    this.logger.info('Log reads started', { objects: total, groups: groups.length });
    const result = noReads();
    let nextGroup = 0;

    // Each worker takes the next group from the same list.
    const readUntilNoGroupsAreLeft = async () => {
      while (nextGroup < groups.length) {
        if (options.shouldStop()) {
          result.stopped = true;
          return;
        }
        const group = groups[nextGroup];
        nextGroup++;
        addReads(result, await this.readGroup(group, options));
        this.logger.info('Log reads progress', { done: result.logs.length + result.failedReads.length, failed: result.failedReads.length, total });
      }
    };

    const workers: Promise<void>[] = [];
    for (let worker = 0; worker < GROUPS_AT_THE_SAME_TIME; worker++) {
      workers.push(readUntilNoGroupsAreLeft());
    }
    await Promise.all(workers);
    this.logger.info('Log reads finished', {
      read: result.logs.length,
      failed: result.failedReads.length,
      notRead: total - result.logs.length - result.failedReads.length,
      stopped: result.stopped,
      durationMs: Date.now() - startedAt,
    });
    return result;
  }

  /**
   * Does the same read as findByObjectUuid and sorts the traces by the requested objectIndex.
   * A trace without an index, or with more than one, never counts as the requested index.
   *
   * @param options The object UUID, the objectIndex (version) and the absolute time range to search.
   * @returns The traces split into requested index, no index, other index and other.
   * @throws CloudWatchSubmissionLogReaderError when the range is invalid or the CloudWatch read is not reliable.
   * @example
   * const { tracesForRequestedIndex } = await reader.findByObjectVersion({ objectUuid, objectIndex: 3, range });
   */
  async findByObjectVersion(options: FindSubmissionLogsByVersionOptions): Promise<SubmissionLogVersionResult> {
    const uuidResult = await this.findByObjectUuid({ objectUuid: options.objectUuid, range: options.range });

    return {
      lookup: { objectUuid: options.objectUuid, objectIndex: options.objectIndex },
      queryRange: uuidResult.queryRange,
      diagnostics: uuidResult.diagnostics,
      ...categorizeTracesByObjectIndex(uuidResult.traces, options.objectIndex),
    };
  }

  /**
   * One receiver query for all objectUuids, and one execution query for all execution_arns it found. Each objectUuid gets its own
   * result, also when CloudWatch had nothing for it. findByObjectUuid uses it with one objectUuid, so one object and a group read the same.
   */
  private async findLogsOfObjects(objectUuids: string[], range: AbsoluteTimeRange): Promise<LogsOfObjects> {
    assertValidRange(range);

    const receiverResult = await this.queryRunner.run({
      queryString: buildReceiverQuery(objectUuids),
      range,
      stage: 'receiver-query',
    });
    const rowsByObjectUuid = groupReceiverRowsByObjectUuid(receiverResult.rows, objectUuids, receiverResult.queryId);
    const receiverTraces = objectUuids.flatMap(objectUuid =>
      buildReceiverTraces(rowsByObjectUuid.get(objectUuid) ?? [], objectUuid, receiverResult.queryId));

    const executionResult = await this.runExecutionQuery(receiverTraces, range);
    const traces = executionResult
      ? attachExecutions(receiverTraces, executionResult.rows, executionResult.queryId)
      : receiverTraces;

    const logs = objectUuids.map(objectUuid => ({
      lookup: { objectUuid },
      queryRange: range,
      traces: traces.filter(trace => trace.objectUuid === objectUuid),
    }));

    if (!this.diagnostics) {
      return { logs };
    }
    return {
      logs,
      diagnostics: {
        receiverQuery: { queryId: receiverResult.queryId, statistics: receiverResult.statistics },
        executionQuery: executionResult ? { queryId: executionResult.queryId, statistics: executionResult.statistics } : undefined,
      },
    };
  }

  // A group in one query; if that fails, in halves (too many rows) or one by one, so one bad objectUuid does not fail the others.
  private async readGroup(objectUuids: string[], options: FindSubmissionLogsByUuidsOptions): Promise<SubmissionLogUuidsResult> {
    const startedAt = Date.now();
    try {
      const found = await this.findLogsOfObjects(objectUuids, options.range);
      this.logger.debug('Logs read', { objects: objectUuids.length, durationMs: Date.now() - startedAt });
      return { logs: found.logs, failedReads: [], diagnostics: found.diagnostics ? [found.diagnostics] : [], stopped: false };
    } catch (error) {
      if (objectUuids.length === 1) {
        this.logger.warn('Log read failed', { objectUuid: objectUuids[0], error });
        return { ...noReads(), failedReads: [{ objectUuid: objectUuids[0], error }] };
      }
      if (isTooManyRows(error)) {
        this.logger.info('Group split, too many rows', { objects: objectUuids.length });
        return this.readInTwoHalves(objectUuids, options);
      }
      this.logger.warn('Group read failed, reading one by one', { objects: objectUuids.length, error });
      return this.readOneByOne(objectUuids, options);
    }
  }

  private async readInTwoHalves(objectUuids: string[], options: FindSubmissionLogsByUuidsOptions): Promise<SubmissionLogUuidsResult> {
    const middle = Math.ceil(objectUuids.length / 2);
    const result = noReads();
    addReads(result, await this.readGroup(objectUuids.slice(0, middle), options));
    addReads(result, await this.readGroup(objectUuids.slice(middle), options));
    return result;
  }

  private async readOneByOne(objectUuids: string[], options: FindSubmissionLogsByUuidsOptions): Promise<SubmissionLogUuidsResult> {
    const result = noReads();
    for (const objectUuid of objectUuids) {
      if (options.shouldStop()) {
        result.stopped = true;
        return result;
      }
      addReads(result, await this.readGroup([objectUuid], options));
    }
    return result;
  }

  // No execution_arn found means no execution query, instead of one with an empty in [] filter.
  private async runExecutionQuery(traces: SubmissionLogTrace[], range: AbsoluteTimeRange): Promise<CwliQueryResult | undefined> {
    const executionArns = collectExecutionArns(traces);
    if (executionArns.length === 0) {
      return undefined;
    }

    const executionRange = {
      fromInclusive: range.fromInclusive,
      toExclusive: new Date(range.toExclusive.getTime() + EXECUTION_QUERY_EXTRA_MS),
    };

    return this.queryRunner.run({
      queryString: buildExecutionQuery(executionArns),
      range: executionRange,
      stage: 'execution-query',
    });
  }
}

function assertValidRange(range: AbsoluteTimeRange): void {
  if (range.fromInclusive.getTime() >= range.toExclusive.getTime()) {
    throw new CloudWatchSubmissionLogReaderError(
      'INVALID_TIME_RANGE',
      'fromInclusive must be before toExclusive',
      { stage: 'receiver-query', queryRange: range },
    );
  }
}

function splitIntoGroups(objectUuids: string[], groupSize: number): string[][] {
  const groups: string[][] = [];
  for (let start = 0; start < objectUuids.length; start += groupSize) {
    groups.push(objectUuids.slice(start, start + groupSize));
  }
  return groups;
}

// More rows than one query returns, or a later page that failed: a smaller group can still succeed.
function isTooManyRows(error: unknown): boolean {
  return error instanceof CloudWatchSubmissionLogReaderError && error.code === 'QUERY_RESULTS_INCOMPLETE';
}

function noReads(): SubmissionLogUuidsResult {
  return { logs: [], failedReads: [], diagnostics: [], stopped: false };
}

function addReads(total: SubmissionLogUuidsResult, reads: SubmissionLogUuidsResult): void {
  total.logs.push(...reads.logs);
  total.failedReads.push(...reads.failedReads);
  total.diagnostics.push(...reads.diagnostics);
  total.stopped = total.stopped || reads.stopped;
}
