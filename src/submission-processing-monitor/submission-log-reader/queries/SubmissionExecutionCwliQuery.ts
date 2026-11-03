import { SubmissionLogField, SubmissionLogGroupTag } from '../../../shared/submission-logging/SubmissionLogging';

/**
 * Reads orchestrator (step function) logging through the shared OpenFormsLog/submission-forwarder-orchestrator tag. This
 * log group is AWS's own Step Functions execution history logging (the state machine's logs.level is
 * ALL), not a custom logger, so the field names (type, id, previous_event_id, details, redrive_count,
 * event_timestamp) are AWS's own and don't come from the shared SubmissionLogField contract. Only
 * execution_arn happens to be the same literal field name on both sides.
 *
 * Filters on the execution_arn values the receiver read already found, never run on its own: an
 * execution_arn without a matching receiver trace isn't something this reader is asked to look up.
 *
 * event_timestamp (Step Functions' own event clock, epoch milliseconds) is selected alongside @timestamp
 * and @ptr. The trace builder uses event_timestamp for SubmissionExecutionLogEvent.timestamp, since it's
 * the state machine's own moment for the event rather than CloudWatch's log-ingestion time.
 *
 * details is a nested JSON object in the log line, not a scalar value, and CWLI's fields command returns
 * it empty rather than as usable content (confirmed in the console: a known non-empty details object came
 * back blank). @message is selected instead so the trace builder can read details from the full JSON.
 */
export function buildExecutionQuery(executionArns: string[]): string {
  const arnList = executionArns.map(arn => `"${arn}"`).join(', ');

  const fields = [
    '@timestamp', '@ptr', '@message',
    'type', 'id', 'previous_event_id', 'event_timestamp', 'redrive_count',
    SubmissionLogField.EXECUTION_ARN,
  ];

  return [
    `SOURCE logGroupTags([{'key':'${SubmissionLogGroupTag.KEY}','values':['${SubmissionLogGroupTag.ORCHESTRATOR}']}])`,
    `| fields ${fields.join(', ')}`,
    `| filter ${SubmissionLogField.EXECUTION_ARN} in [${arnList}]`,
    '| sort @timestamp asc',
  ].join('\n');
}
