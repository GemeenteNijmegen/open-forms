import { SubmissionLogField } from '../../../shared/submission-logging/SubmissionLogging';
import { CloudWatchSubmissionLogReaderError } from '../errors/CloudWatchSubmissionLogReaderError';
import { SubmissionExecutionLogEvent, SubmissionLogTrace, SubmissionReceiverLogEvent } from '../SubmissionLogReaderTypes';

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

// All execution_arn values found across every trace's receiverEvents, for the caller to run the execution query on.
export function collectExecutionArns(traces: SubmissionLogTrace[]): string[] {
  const arns = new Set<string>();
  for (const trace of traces) {
    for (const executionArn of distinctExecutionArns(trace)) {
      arns.add(executionArn);
    }
  }
  return Array.from(arns);
}

/**
 * Attaches execution events to each trace by the execution_arn values found in its own receiverEvents. A
 * known execution_arn with zero matching execution rows still gets an entry with an empty events array,
 * that's valid data (see the module README), not something this function treats as an error.
 */
export function attachExecutions(traces: SubmissionLogTrace[], executionRows: Record<string, string>[]): SubmissionLogTrace[] {
  const eventsByArn = groupExecutionEventsByArn(executionRows);

  return traces.map(trace => ({
    ...trace,
    executions: distinctExecutionArns(trace).map(executionArn => ({
      execution_arn: executionArn,
      events: eventsByArn.get(executionArn) ?? [],
    })),
  }));
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

// Found as-is, in the order first observed within this trace's own receiverEvents. Normally one value.
function distinctExecutionArns(trace: SubmissionLogTrace): string[] {
  const arns: string[] = [];
  for (const event of trace.receiverEvents) {
    if (event.execution_arn && !arns.includes(event.execution_arn)) {
      arns.push(event.execution_arn);
    }
  }
  return arns;
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

/**
 * Groups by execution_arn and sorts each group by Step Functions' own id rather than by timestamp. id is
 * a strictly increasing sequence per execution, unlike @timestamp/event_timestamp, which can tie for
 * events recorded in the same instant and would then leave the order CloudWatch happened to return them in.
 */
function groupExecutionEventsByArn(rows: Record<string, string>[]): Map<string, SubmissionExecutionLogEvent[]> {
  const eventsByArn = new Map<string, SubmissionExecutionLogEvent[]>();

  for (const row of rows) {
    const executionArn = row[SubmissionLogField.EXECUTION_ARN];
    if (!executionArn) {
      throw new CloudWatchSubmissionLogReaderError(
        'QUERY_RESULT_MAPPING_FAILED',
        'Execution row is missing execution_arn',
        { stage: 'result-mapping' },
      );
    }

    const events = eventsByArn.get(executionArn) ?? [];
    events.push(executionRowToEvent(row));
    eventsByArn.set(executionArn, events);
  }

  for (const events of eventsByArn.values()) {
    events.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  }

  return eventsByArn;
}

/**
 * event_timestamp is Step Functions' own epoch-millisecond event clock, already absolute, so unlike the
 * receiver's @timestamp it needs no UTC rewriting before new Date(...) reads it correctly.
 */
function executionRowToEvent(row: Record<string, string>): SubmissionExecutionLogEvent {
  const id = row.id;
  const previousEventId = row.previous_event_id;
  const redriveCount = row.redrive_count;

  return {
    timestamp: new Date(Number(row.event_timestamp)),
    type: row.type,
    id: id ? Number(id) : undefined,
    previousEventId: previousEventId ? Number(previousEventId) : undefined,
    redriveCount: redriveCount ? Number(redriveCount) : undefined,
    details: detailsFromMessage(row['@message']),
    logRecordPointer: row['@ptr'],
  };
}

/**
 * details is a nested object in the log line; CWLI's fields command can't return it directly (see
 * buildExecutionQuery), so it's read from the full @message JSON instead.
 */
function detailsFromMessage(message: string | undefined): unknown {
  return message ? JSON.parse(message).details : undefined;
}
