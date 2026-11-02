import { SubmissionLogField } from '../../../shared/submission-logging/SubmissionLogging';
import { CloudWatchSubmissionLogReaderError } from '../errors/CloudWatchSubmissionLogReaderError';
import { SubmissionLogTrace, SubmissionReceiverLogEvent } from '../SubmissionLogReaderTypes';

/**
 * Groups raw receiver rows by correlation_id into traces. A row without a correlation_id can't be grouped
 * reliably, so that's a mapping failure rather than a silently dropped row.
 */
export function buildReceiverTraces(rows: Record<string, string>[], objectUuid: string, queryId: string): SubmissionLogTrace[] {
  const rowsByCorrelationId = new Map<string, Record<string, string>[]>();

  for (const row of rows) {
    const correlationId = row[SubmissionLogField.CORRELATION_ID];
    if (!correlationId) {
      throw new CloudWatchSubmissionLogReaderError(
        'QUERY_RESULT_MAPPING_FAILED',
        'Receiver row is missing correlation_id',
        { stage: 'result-mapping', queryId },
      );
    }

    const group = rowsByCorrelationId.get(correlationId) ?? [];
    group.push(row);
    rowsByCorrelationId.set(correlationId, group);
  }

  return Array.from(rowsByCorrelationId.entries()).map(
    ([correlationId, correlationRows]) => buildTrace(correlationId, correlationRows, objectUuid),
  );
}

function buildTrace(correlationId: string, rows: Record<string, string>[], objectUuid: string): SubmissionLogTrace {
  // Equal @timestamp values keep CloudWatch's own row order here, which is not a guaranteed lifecycle order.
  const receiverEvents = rows.map(receiverRowToEvent).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return {
    correlation_id: correlationId,
    objectUuid,
    objectIndexes: distinctObjectIndexes(receiverEvents),
    firstSeen: receiverEvents[0].timestamp,
    lastSeen: receiverEvents[receiverEvents.length - 1].timestamp,
    receiverEvents,
    executions: [],
  };
}

/**
 * Found as-is, in the order first observed. Multiple distinct values are unexpected data, not an error
 * the reader resolves on the caller's behalf.
 */
function distinctObjectIndexes(events: SubmissionReceiverLogEvent[]): number[] {
  const indexes: number[] = [];
  for (const event of events) {
    if (event.objectIndex !== undefined && !indexes.includes(event.objectIndex)) {
      indexes.push(event.objectIndex);
    }
  }
  return indexes;
}

/**
 * CWLI returns @timestamp/@ingestionTime as "2026-01-01 10:00:00.000", in UTC but without a timezone
 * marker. new Date(...) on that exact format reads it as local time instead of UTC. Replacing the space
 * with a T and appending Z turns it into "2026-01-01T10:00:00.000Z", which new Date(...) does read as UTC.
 */
function cwliTimestampToUtcDate(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`);
}

function receiverRowToEvent(row: Record<string, string>): SubmissionReceiverLogEvent {
  const objectIndex = row[SubmissionLogField.OBJECT_INDEX];
  const ingestionTime = row['@ingestionTime'];

  return {
    timestamp: cwliTimestampToUtcDate(row['@timestamp']),
    ingestionTime: ingestionTime ? cwliTimestampToUtcDate(ingestionTime) : undefined,
    event: row[SubmissionLogField.EVENT] as SubmissionReceiverLogEvent['event'],
    objectUuid: row[SubmissionLogField.OBJECT_UUID],
    objectIndex: objectIndex ? Number(objectIndex) : undefined,
    objectTypeUrl: row[SubmissionLogField.OBJECT_TYPE_URL],
    reference: row[SubmissionLogField.REFERENCE],
    formName: row[SubmissionLogField.FORMNAME],
    esfStatus: row[SubmissionLogField.ESF_STATUS],
    execution_arn: row[SubmissionLogField.EXECUTION_ARN],
    reason: row[SubmissionLogField.REASON],
    resourceUrl: row[SubmissionLogField.RESOURCE_URL],
    logRecordPointer: row['@ptr'],
  };
}
