import { QueryStatistics } from '@aws-sdk/client-cloudwatch-logs';
import { AbsoluteTimeRange } from '../SubmissionLogReaderTypes';

export type CloudWatchSubmissionLogReaderErrorCode =
  | 'INVALID_TIME_RANGE'
  | 'QUERY_START_FAILED'
  | 'QUERY_FAILED'
  | 'QUERY_CANCELLED'
  | 'QUERY_TIMEOUT'
  | 'QUERY_RESULTS_FAILED'
  | 'QUERY_RESULTS_INCOMPLETE'
  | 'QUERY_RESULT_LIMIT_REACHED'
  | 'QUERY_RESULT_MAPPING_FAILED';

export type CloudWatchSubmissionLogReaderStage =
  | 'receiver-query'
  | 'execution-query'
  | 'result-mapping';

export interface CloudWatchSubmissionLogReaderErrorContext {
  stage: CloudWatchSubmissionLogReaderStage;
  queryId?: string;
  queryStatus?: string;
  queryRange?: AbsoluteTimeRange;
  sourceLogGroups?: string[];
  statistics?: QueryStatistics;
  awsRequestId?: string;
}

/**
 * Thrown for a technically unreliable CloudWatch read. The caller never gets a partial normal
 * result alongside this error, only the error itself. Never carries raw @message content, full
 * result rows or tokens; the context is limited to what's needed to trace the failing query.
 */
export class CloudWatchSubmissionLogReaderError extends Error {
  constructor(
    public readonly code: CloudWatchSubmissionLogReaderErrorCode,
    message: string,
    public readonly context: CloudWatchSubmissionLogReaderErrorContext,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'CloudWatchSubmissionLogReaderError';
  }
}
