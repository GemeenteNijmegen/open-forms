import { SubmissionLogField, SubmissionLogGroupTag } from '../../../shared/submission-logging/SubmissionLogging';

/**
 * Step Functions writes this log itself, so the field names are AWS's own. Only execution_arn matches SubmissionLogField.
 * Filters on the execution_arn values the receiver query found.
 * details is a nested object and fields returns it empty, so @message is selected and the trace builder reads details from it.
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
