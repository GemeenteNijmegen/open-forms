import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { CloudWatchLogsQueryRunner } from './cloudwatch/CloudWatchLogsQueryRunner';
import { CloudWatchSubmissionLogReaderError } from './errors/CloudWatchSubmissionLogReaderError';
import { buildExecutionQuery } from './queries/SubmissionExecutionCwliQuery';
import { buildReceiverQuery } from './queries/SubmissionReceiverCwliQuery';
import {
  AbsoluteTimeRange, FindSubmissionLogsByUuidOptions, FindSubmissionLogsByVersionOptions,
  SubmissionLogTrace, SubmissionLogUuidResult, SubmissionLogVersionResult,
} from './SubmissionLogReaderTypes';
import { attachExecutions, buildReceiverTraces, categorizeTracesByObjectIndex, collectExecutionArns } from './traces/SubmissionTraceBuilder';

// An execution started just before toExclusive can log its last events after it. The orchestrator has no Wait states; its slowest
// Lambdas time out at 5 minutes with 3 retries per task, so one hour covers a full execution.
const EXECUTION_QUERY_EXTRA_MS = 60 * 60 * 1000;

export interface CloudWatchSubmissionLogReaderOptions {
  cloudWatchLogsClient?: CloudWatchLogsClient;

  // Functional code must not depend on diagnostics being present.
  diagnostics?: boolean;
}

export class CloudWatchSubmissionLogReader {
  private readonly diagnostics: boolean;
  private readonly queryRunner: CloudWatchLogsQueryRunner;

  constructor(options: CloudWatchSubmissionLogReaderOptions = {}) {
    this.diagnostics = options.diagnostics ?? false;
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
   * const range = amsterdamCalendarDayToAbsoluteTimeRange({ year: 2026, month: 11, day: 2 });
   * const { traces } = await reader.findByObjectUuid({ objectUuid, range });
   */
  async findByObjectUuid(options: FindSubmissionLogsByUuidOptions): Promise<SubmissionLogUuidResult> {
    assertValidRange(options.range);

    const receiverResult = await this.queryRunner.run({
      queryString: buildReceiverQuery(options.objectUuid),
      range: options.range,
      stage: 'receiver-query',
    });

    const traces = buildReceiverTraces(receiverResult.rows, options.objectUuid, receiverResult.queryId);

    return {
      lookup: { objectUuid: options.objectUuid },
      queryRange: options.range,
      traces: await this.addExecutionEvents(traces, options.range),
    };
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
      ...categorizeTracesByObjectIndex(uuidResult.traces, options.objectIndex),
    };
  }

  // No execution_arn found means no execution query, instead of one with an empty in [] filter.
  private async addExecutionEvents(traces: SubmissionLogTrace[], range: AbsoluteTimeRange): Promise<SubmissionLogTrace[]> {
    const executionArns = collectExecutionArns(traces);
    if (executionArns.length === 0) {
      return traces;
    }

    const executionRange = {
      fromInclusive: range.fromInclusive,
      toExclusive: new Date(range.toExclusive.getTime() + EXECUTION_QUERY_EXTRA_MS),
    };

    const executionResult = await this.queryRunner.run({
      queryString: buildExecutionQuery(executionArns),
      range: executionRange,
      stage: 'execution-query',
    });

    return attachExecutions(traces, executionResult.rows);
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
