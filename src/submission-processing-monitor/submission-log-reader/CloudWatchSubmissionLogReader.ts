import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { CloudWatchLogsQueryRunner } from './cloudwatch/CloudWatchLogsQueryRunner';
import { CloudWatchSubmissionLogReaderError } from './errors/CloudWatchSubmissionLogReaderError';
import { buildReceiverQuery } from './queries/SubmissionReceiverCwliQuery';
import { AbsoluteTimeRange, FindSubmissionLogsByUuidOptions, SubmissionLogUuidResult } from './SubmissionLogReaderTypes';
import { buildReceiverTraces } from './traces/SubmissionTraceBuilder';

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

    const result = await this.queryRunner.run({
      queryString: buildReceiverQuery(options.objectUuid),
      range: options.range,
      stage: 'receiver-query',
    });

    return {
      lookup: { objectUuid: options.objectUuid },
      queryRange: options.range,
      traces: buildReceiverTraces(result.rows, options.objectUuid, result.queryId),
    };
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
