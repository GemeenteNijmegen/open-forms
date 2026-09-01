import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';

export interface CloudWatchSubmissionLogReaderOptions {
  cloudWatchLogsClient?: CloudWatchLogsClient;

  /** Functional code must not depend on diagnostics being present. */
  diagnostics?: boolean;
}

export class CloudWatchSubmissionLogReader {
  private readonly cloudWatchLogsClient: CloudWatchLogsClient;
  private readonly diagnostics: boolean;

  constructor(options: CloudWatchSubmissionLogReaderOptions = {}) {
    this.cloudWatchLogsClient = options.cloudWatchLogsClient ?? new CloudWatchLogsClient({});
    this.diagnostics = options.diagnostics ?? false;
  }
}
