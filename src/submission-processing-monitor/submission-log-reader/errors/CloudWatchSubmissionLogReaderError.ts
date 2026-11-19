import { QueryStatistics } from '@aws-sdk/client-cloudwatch-logs';
import { AbsoluteTimeRange } from '../SubmissionLogReaderTypes';

/**
 * The monitor handles every code the same way: the check is incomplete. queryStatus, awsRequestId and the message say what went wrong.
 *
 * INVALID_TIME_RANGE: the range is empty or reversed. Nothing was sent to CloudWatch.
 * QUERY_FAILED: the query did not start, ended with a status other than Complete, ran past the local timeout,
 * or its first results could not be fetched.
 * QUERY_RESULTS_INCOMPLETE: a later result page failed, or the row count reached the limit.
 * QUERY_RESULT_MAPPING_FAILED: a result row does not have the expected shape.
 */
export type CloudWatchSubmissionLogReaderErrorCode =
  | 'INVALID_TIME_RANGE'
  | 'QUERY_FAILED'
  | 'QUERY_RESULTS_INCOMPLETE'
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

// The caller never gets a partial result next to this error. The context holds no @message content or result rows.
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
