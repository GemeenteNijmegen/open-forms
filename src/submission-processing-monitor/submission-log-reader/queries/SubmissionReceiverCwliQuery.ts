import { SubmissionLogField, SubmissionLogGroupTag } from '../../../shared/submission-logging/SubmissionLogging';

/**
 * Selects the receiver log groups by tag, so a redeploy with a new log group name keeps working.
 * Filters on objectUuid, not objectIndex: the first receiver events are logged before the index is known. One query can look for several
 * objectUuids; one object is a list of one.
 * @message is left out, @ptr is enough to fetch the full record later. The time range goes to StartQuery.
 */
export function buildReceiverQuery(objectUuids: string[]): string {
  const uuidList = objectUuids.map(objectUuid => `"${objectUuid}"`).join(', ');

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
    `| filter ${SubmissionLogField.OBJECT_UUID} in [${uuidList}]`,
    '| sort @timestamp asc',
  ].join('\n');
}
