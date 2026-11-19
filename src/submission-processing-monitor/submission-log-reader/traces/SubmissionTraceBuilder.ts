import { SubmissionLogField } from '../../../shared/submission-logging/SubmissionLogging';
import { CloudWatchSubmissionLogReaderError } from '../errors/CloudWatchSubmissionLogReaderError';
import {
  SubmissionExecutionLogEvent, SubmissionLogTrace, SubmissionLogVersionCategories, SubmissionReceiverLogEvent,
} from '../SubmissionLogReaderTypes';

// One trace per correlation_id. A row without correlation_id cannot be placed, so it fails instead of being dropped.
export function buildReceiverTraces(rows: Record<string, string>[], objectUuid: string, queryId: string): SubmissionLogTrace[] {
  const rowsByCorrelationId = new Map<string, Record<string, string>[]>();

  for (const row of rows) {
    const correlationId = row[SubmissionLogField.CORRELATION_ID];
    if (!correlationId) {
      throw mappingFailed('Receiver row is missing correlation_id', queryId);
    }

    const group = rowsByCorrelationId.get(correlationId) ?? [];
    group.push(row);
    rowsByCorrelationId.set(correlationId, group);
  }

  const traces: SubmissionLogTrace[] = [];
  for (const [correlationId, correlationRows] of rowsByCorrelationId) {
    traces.push(buildTrace(correlationId, correlationRows, objectUuid, queryId));
  }
  return traces;
}

export function collectExecutionArns(traces: SubmissionLogTrace[]): string[] {
  const arns = new Set<string>();
  for (const trace of traces) {
    for (const executionArn of distinctExecutionArns(trace)) {
      arns.add(executionArn);
    }
  }
  return Array.from(arns);
}

// A known execution_arn without execution rows keeps an entry with empty events. That is valid data, not an error.
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

// Only a trace whose one and only index is the requested index counts as that index.
export function categorizeTracesByObjectIndex(traces: SubmissionLogTrace[], objectIndex: number): SubmissionLogVersionCategories {
  const categories: SubmissionLogVersionCategories = {
    tracesForRequestedIndex: [],
    tracesWithoutObjectIndex: [],
    tracesForOtherIndexes: [],
    otherTraces: [],
  };

  for (const trace of traces) {
    if (trace.objectIndexes.length === 0) {
      categories.tracesWithoutObjectIndex.push(trace);
    } else if (trace.objectIndexes.length > 1) {
      categories.otherTraces.push(trace);
    } else if (trace.objectIndexes[0] === objectIndex) {
      categories.tracesForRequestedIndex.push(trace);
    } else {
      categories.tracesForOtherIndexes.push(trace);
    }
  }

  return categories;
}

function buildTrace(correlationId: string, rows: Record<string, string>[], objectUuid: string, queryId: string): SubmissionLogTrace {
  // Equal timestamps keep CloudWatch's row order, which is not a guaranteed lifecycle order.
  const receiverEvents = rows.map(row => receiverRowToEvent(row, queryId)).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

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

// More than one index is unexpected, but it is returned as found. The reader does not pick one.
function distinctObjectIndexes(events: SubmissionReceiverLogEvent[]): number[] {
  const indexes: number[] = [];
  for (const event of events) {
    if (event.objectIndex !== undefined && !indexes.includes(event.objectIndex)) {
      indexes.push(event.objectIndex);
    }
  }
  return indexes;
}

function distinctExecutionArns(trace: SubmissionLogTrace): string[] {
  const arns: string[] = [];
  for (const event of trace.receiverEvents) {
    if (event.execution_arn && !arns.includes(event.execution_arn)) {
      arns.push(event.execution_arn);
    }
  }
  return arns;
}

// CWLI gives "2026-01-01 10:00:00.000" in UTC without a timezone. Without the T and Z, new Date() reads it as local time.
function cwliTimestampToUtcDate(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`);
}

function receiverRowToEvent(row: Record<string, string>, queryId: string): SubmissionReceiverLogEvent {
  const timestamp = cwliTimestampToUtcDate(row['@timestamp']);
  if (Number.isNaN(timestamp.getTime())) {
    throw mappingFailed('Receiver row has an unreadable @timestamp', queryId);
  }

  const objectIndexValue = row[SubmissionLogField.OBJECT_INDEX];
  const objectIndex = objectIndexValue ? Number(objectIndexValue) : undefined;
  if (objectIndex !== undefined && !Number.isInteger(objectIndex)) {
    throw mappingFailed('Receiver row has an objectIndex that is not a whole number', queryId);
  }

  const ingestionTime = row['@ingestionTime'];

  return {
    timestamp,
    ingestionTime: ingestionTime ? cwliTimestampToUtcDate(ingestionTime) : undefined,
    event: row[SubmissionLogField.EVENT] as SubmissionReceiverLogEvent['event'],
    objectUuid: row[SubmissionLogField.OBJECT_UUID],
    objectIndex,
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

// Sorted on the Step Functions id: it goes up per execution, while timestamps can be equal.
function groupExecutionEventsByArn(rows: Record<string, string>[]): Map<string, SubmissionExecutionLogEvent[]> {
  const eventsByArn = new Map<string, SubmissionExecutionLogEvent[]>();

  for (const row of rows) {
    const executionArn = row[SubmissionLogField.EXECUTION_ARN];
    if (!executionArn) {
      throw mappingFailed('Execution row is missing execution_arn');
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

// event_timestamp is the Step Functions clock in epoch milliseconds, not the CloudWatch @timestamp.
function executionRowToEvent(row: Record<string, string>): SubmissionExecutionLogEvent {
  const id = row.id;
  const previousEventId = row.previous_event_id;
  const redriveCount = row.redrive_count;

  const timestamp = new Date(Number(row.event_timestamp));
  if (Number.isNaN(timestamp.getTime())) {
    throw mappingFailed('Execution row has an unreadable event_timestamp');
  }

  return {
    timestamp,
    type: row.type,
    id: id ? Number(id) : undefined,
    previousEventId: previousEventId ? Number(previousEventId) : undefined,
    redriveCount: redriveCount ? Number(redriveCount) : undefined,
    details: detailsFromMessage(row['@message']),
    logRecordPointer: row['@ptr'],
  };
}

// fields returns details empty because it is a nested object, so it is read from @message.
function detailsFromMessage(message: string | undefined): unknown {
  if (!message) {
    return undefined;
  }

  try {
    return JSON.parse(message).details;
  } catch (cause) {
    throw mappingFailed('Execution row has an @message that is not valid JSON', undefined, cause);
  }
}

function mappingFailed(message: string, queryId?: string, cause?: unknown): CloudWatchSubmissionLogReaderError {
  return new CloudWatchSubmissionLogReaderError('QUERY_RESULT_MAPPING_FAILED', message, { stage: 'result-mapping', queryId }, { cause });
}
