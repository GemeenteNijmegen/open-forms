import type { QueryStatistics } from '@aws-sdk/client-cloudwatch-logs';
import { SubmissionLogEventValue, SubmissionExecutionEventValue } from '../../shared/submission-logging/SubmissionLogging';

/**
 * fromInclusive is part of the range, toExclusive is not. Both are absolute timestamps; the
 * reader itself does not convert timezones or calendar days.
 *
 * Example: `fromInclusive = 2026-01-01T00:00:00Z`, `toExclusive = 2026-01-02T00:00:00Z` matches
 * everything from that midnight up to, but not including, the next one. An event logged exactly
 * at `2026-01-02T00:00:00Z` falls outside this range.
 *
 * Might be important when a group of logs is just around the ranges edges. Part in, part out.
 */
export interface AbsoluteTimeRange {
  fromInclusive: Date;
  toExclusive: Date;
}

export interface FindSubmissionLogsByUuidOptions {
  objectUuid: string;
  range: AbsoluteTimeRange;
}

export interface FindSubmissionLogsByVersionOptions {
  objectUuid: string;
  objectIndex: number;
  range: AbsoluteTimeRange;
}

/** Field names mirror `SubmissionLogField` in the shared logging contract exactly. */
export interface SubmissionReceiverLogEvent {
  timestamp: Date;
  ingestionTime?: Date;
  event?: SubmissionLogEventValue;
  objectUuid?: string;
  objectIndex?: number;
  objectType?: string;
  objectTypeUrl?: string;
  reference?: string;
  formName?: string;
  esfStatus?: string;
  execution_arn?: string;
  reason?: string;
  resourceUrl?: string;

  /**
   * CWLI's `@ptr` value for this log line. Pass it to the CloudWatch Logs `GetLogRecord` call
   * to fetch the full original log record on demand, so we don't have to store it here.
   */
  logRecordPointer?: string;
}

export interface SubmissionExecutionLogEvent {
  timestamp: Date;
  type: SubmissionExecutionEventValue | string;
  id?: number;
  previousEventId?: number;
  details?: unknown;
  logRecordPointer?: string;
}

export interface SubmissionExecutionTrace {
  execution_arn: string;

  /** An empty array is valid data: the ARN was known, but no execution events were found. */
  events: SubmissionExecutionLogEvent[];
}

export interface SubmissionLogTrace {
  /** Same name as in the structured logging. */
  correlation_id: string;

  objectUuid: string;

  /**
   * All objectIndex values actually found within this correlation_id.
   * Normally [] or [index]. An unexpected [3, 4] is returned as-is; the reader does not pick a "correct" value.
   */
  objectIndexes: number[];

  firstSeen: Date;
  lastSeen: Date;

  /**
   * Sorted by CloudWatch @timestamp ascending. Events with an identical timestamp keep the order
   * CloudWatch returned them in, which is not necessarily their actual receiver lambda or step function lifecycle order.
   */
  receiverEvents: SubmissionReceiverLogEvent[];

  executions: SubmissionExecutionTrace[];
}

export interface SubmissionLogUuidResult {
  lookup: { objectUuid: string };
  queryRange: AbsoluteTimeRange;
  traces: SubmissionLogTrace[];
  diagnostics?: SubmissionLogReaderDiagnostics;
}

export interface SubmissionLogVersionResult {
  lookup: {
    objectUuid: string;
    objectIndex: number;
  };

  queryRange: AbsoluteTimeRange;

  tracesForRequestedIndex: SubmissionLogTrace[];
  tracesWithoutObjectIndex: SubmissionLogTrace[];
  tracesForOtherIndexes: SubmissionLogTrace[];

  /**
   * Traces that don't fit the categories above, e.g. multiple different indexes within one
   * correlation_id. Not a functional error classification.
   */
  otherTraces: SubmissionLogTrace[];
}

export interface SubmissionLogReaderDiagnostics {
  receiverQuery?: CwliQueryDiagnostics;
  executionQuery?: CwliQueryDiagnostics;
}

/** Composes our own query context with the SDK's own statistics shape instead of copying its fields. */
export interface CwliQueryDiagnostics {
  queryId: string;
  sourceLogGroups: string[];
  statistics?: QueryStatistics;
}
