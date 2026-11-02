import { SubmissionLogField, SubmissionLogGroupTag } from '../../../shared/submission-logging/SubmissionLogging';

/**
 * Reads receiver (lambda) logging through the shared OpenFormsLog/submission-forwarder-receiver tag, so a redeploy
 * that changes the physical Log Group name doesn't break this query.
 *
 * Filters on objectUuid instead of objectIndex: the earliest receiver events (notification received, object
 * fetch started) are logged before an objectIndex is known, so an objectIndex filter would miss them.
 *
 * Selects the compact structured fields plus @timestamp, @ingestionTime and @ptr. @message is left out;
 * @ptr lets a caller fetch the full record later with GetLogRecord if needed. The time range itself is not
 * part of this query string, StartQuery takes that separately.
 */
export function buildReceiverQuery(objectUuid: string): string {
  const fields = [
    '@timestamp', '@ingestionTime', '@ptr',
    SubmissionLogField.CORRELATION_ID,
    SubmissionLogField.EVENT,
    SubmissionLogField.OBJECT_UUID,
    SubmissionLogField.OBJECT_INDEX,
    SubmissionLogField.OBJECT_TYPE_URL,
    SubmissionLogField.REFERENCE,
    SubmissionLogField.FORMNAME,
    SubmissionLogField.ESF_STATUS,
    SubmissionLogField.EXECUTION_ARN,
    SubmissionLogField.REASON,
    SubmissionLogField.RESOURCE_URL,
  ];

  return [
    `SOURCE logGroupTags([{'key':'${SubmissionLogGroupTag.KEY}','values':['${SubmissionLogGroupTag.RECEIVER}']}])`,
    `| fields ${fields.join(', ')}`,
    `| filter ${SubmissionLogField.OBJECT_UUID} = "${objectUuid}"`,
    '| sort @timestamp asc',
  ].join('\n');
}
