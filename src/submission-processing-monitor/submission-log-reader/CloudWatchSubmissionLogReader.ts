import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { CloudWatchLogsQueryRunner } from './cloudwatch/CloudWatchLogsQueryRunner';
import { CloudWatchSubmissionLogReaderError } from './errors/CloudWatchSubmissionLogReaderError';
import { buildExecutionQuery } from './queries/SubmissionExecutionCwliQuery';
import { buildReceiverQuery } from './queries/SubmissionReceiverCwliQuery';
import { AbsoluteTimeRange, FindSubmissionLogsByUuidOptions, SubmissionLogTrace, SubmissionLogUuidResult } from './SubmissionLogReaderTypes';
import { attachExecutions, buildReceiverTraces, collectExecutionArns } from './traces/SubmissionTraceBuilder';

export interface CloudWatchSubmissionLogReaderOptions {
  cloudWatchLogsClient?: CloudWatchLogsClient;

  // Functional code must not depend on diagnostics being present.
  diagnostics?: boolean;
}

export class CloudWatchSubmissionLogReader {
  private readonly cloudWatchLogsClient: CloudWatchLogsClient;
  private readonly diagnostics: boolean;
  private readonly queryRunner: CloudWatchLogsQueryRunner;

  constructor(options: CloudWatchSubmissionLogReaderOptions = {}) {
    this.cloudWatchLogsClient = options.cloudWatchLogsClient ?? new CloudWatchLogsClient({});
    this.diagnostics = options.diagnostics ?? false;
    this.queryRunner = new CloudWatchLogsQueryRunner({ cloudWatchLogsClient: this.cloudWatchLogsClient });
  }

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
      traces: await this.withExecutions(traces, options.range),
    };
  }

  /**
   * Skips the execution query entirely when no receiver event mentioned an execution_arn, rather than
   * running a query with an empty "in []" filter.
   */
  private async withExecutions(traces: SubmissionLogTrace[], range: AbsoluteTimeRange): Promise<SubmissionLogTrace[]> {
    const executionArns = collectExecutionArns(traces);
    if (executionArns.length === 0) {
      return traces;
    }

    const executionResult = await this.queryRunner.run({
      queryString: buildExecutionQuery(executionArns),
      range,
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
