/**
 * Shared logging contract for submission processing.
 *
 * The submission-forwarder writes these values.
 * The submission-processing-monitor uses them when querying CloudWatch.
 */

/**
 * De tags
 */
export const SubmissionLogGroupTag = {
  KEY: 'OpenFormsLog',
  RECEIVER: 'submission-forwarder-receiver',
  ORCHESTRATOR: 'submission-forwarder-orchestrator',
} as const;


/**
 * We log with these and also retrieve logs with these
 */
export const SubmissionLogEvent = {
  NOTIFICATION_RECEIVED: 'submission.notification.received',

  OBJECT_FETCH_STARTED: 'submission.object.fetch.started',
  OBJECT_FETCH_SUCCEEDED: 'submission.object.fetch.succeeded',
  OBJECT_FETCH_FAILED: 'submission.object.fetch.failed',

  OBJECT_PARSED: 'submission.object.parsed',
  OBJECT_IGNORED: 'submission.object.ignored',

  EXECUTION_STARTING: 'submission.execution.starting',
  EXECUTION_STARTED: 'submission.execution.started',
  EXECUTION_START_FAILED: 'submission.execution.start.failed',
} as const;

export const SubmissionExecutionEvent = {
  STARTED: 'ExecutionStarted',
  SUCCEEDED: 'ExecutionSucceeded',
  FAILED: 'ExecutionFailed',
  TIMED_OUT: 'ExecutionTimedOut',
  ABORTED: 'ExecutionAborted',
} as const;

export const SubmissionLogField = {
  EVENT: 'event',
  OBJECT_UUID: 'objectUuid',
  OBJECT_INDEX: 'objectIndex',
  OBJECT_TYPE: 'objectType',
  OBJECT_TYPE_URL: 'objectTypeUrl',
  REFERENCE: 'reference',
  FORMNAME: 'formName',
  ESF_STATUS: 'esfStatus',
  EXECUTION_ARN: 'execution_arn',
  REASON: 'reason',
  RESOURCE_URL: 'resourceUrl',
  CORRELATION_ID: 'correlationId',
} as const;

export type SubmissionLogEventValue =
  typeof SubmissionLogEvent[keyof typeof SubmissionLogEvent];

export type SubmissionExecutionEventValue =
  typeof SubmissionExecutionEvent[
    keyof typeof SubmissionExecutionEvent
  ];
