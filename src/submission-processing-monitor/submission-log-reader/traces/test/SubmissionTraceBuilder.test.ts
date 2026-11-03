import { CloudWatchSubmissionLogReaderError } from '../../errors/CloudWatchSubmissionLogReaderError';
import { attachExecutions, buildReceiverTraces, collectExecutionArns } from '../SubmissionTraceBuilder';

function row(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    '@timestamp': '2026-01-01 10:00:00.000',
    'correlation_id': 'correlation-a',
    'event': 'submission.notification.received',
    'objectUuid': 'abc-123',
    ...overrides,
  };
}

describe('buildReceiverTraces', () => {
  test('builds one trace for a single correlation_id with an objectIndex', () => {
    const rows = [
      row({ '@timestamp': '2026-01-01 10:00:00.000', 'event': 'submission.notification.received' }),
      row({ '@timestamp': '2026-01-01 10:00:01.000', 'event': 'submission.object.fetch.succeeded', 'objectIndex': '3' }),
    ];

    const [trace] = buildReceiverTraces(rows, 'abc-123', 'query-1');

    expect(trace.correlation_id).toEqual('correlation-a');
    expect(trace.objectIndexes).toEqual([3]);
    expect(trace.receiverEvents).toHaveLength(2);
    expect(trace.executions).toEqual([]);
  });

  test('keeps separate correlation_ids as separate traces, without merging indexes', () => {
    const rows = [
      row({ correlation_id: 'correlation-a', objectIndex: '1' }),
      row({ correlation_id: 'correlation-b', objectIndex: '2' }),
    ];

    const traces = buildReceiverTraces(rows, 'abc-123', 'query-1');

    expect(traces).toHaveLength(2);
    expect(traces.find(t => t.correlation_id === 'correlation-a')?.objectIndexes).toEqual([1]);
    expect(traces.find(t => t.correlation_id === 'correlation-b')?.objectIndexes).toEqual([2]);
  });

  test('keeps two attempts for the same objectIndex as two traces, not deduplicated', () => {
    const rows = [
      row({ correlation_id: 'correlation-a', objectIndex: '3' }),
      row({ correlation_id: 'correlation-b', objectIndex: '3' }),
    ];

    expect(buildReceiverTraces(rows, 'abc-123', 'query-1')).toHaveLength(2);
  });

  test('keeps multiple objectIndexes within one correlation_id as-is', () => {
    const rows = [
      row({ objectIndex: '3' }),
      row({ objectIndex: '4' }),
    ];

    const [trace] = buildReceiverTraces(rows, 'abc-123', 'query-1');
    expect(trace.objectIndexes).toEqual([3, 4]);
  });

  test('keeps duplicate lifecycle events instead of deduplicating them', () => {
    const rows = [
      row({ event: 'submission.object.fetch.started' }),
      row({ event: 'submission.object.fetch.started' }),
    ];

    const [trace] = buildReceiverTraces(rows, 'abc-123', 'query-1');
    expect(trace.receiverEvents).toHaveLength(2);
  });

  test('sorts receiverEvents ascending on @timestamp regardless of row order', () => {
    const rows = [
      row({ '@timestamp': '2026-01-01 10:00:05.000', 'event': 'submission.execution.started' }),
      row({ '@timestamp': '2026-01-01 10:00:00.000', 'event': 'submission.notification.received' }),
    ];

    const [trace] = buildReceiverTraces(rows, 'abc-123', 'query-1');

    expect(trace.receiverEvents.map(e => e.event)).toEqual([
      'submission.notification.received',
      'submission.execution.started',
    ]);
    expect(trace.firstSeen).toEqual(trace.receiverEvents[0].timestamp);
    expect(trace.lastSeen).toEqual(trace.receiverEvents[1].timestamp);
  });

  test('parses the CWLI timestamp as UTC, not local time', () => {
    const [trace] = buildReceiverTraces([row({ '@timestamp': '2026-01-01 10:00:00.000' })], 'abc-123', 'query-1');
    expect(trace.receiverEvents[0].timestamp.getTime()).toEqual(Date.UTC(2026, 0, 1, 10, 0, 0));
  });

  test('throws QUERY_RESULT_MAPPING_FAILED for a row without correlation_id', () => {
    const rows = [row({ correlation_id: '' })];
    expect(() => buildReceiverTraces(rows, 'abc-123', 'query-1')).toThrow(CloudWatchSubmissionLogReaderError);
  });
});

const executionArn = 'arn:aws:states:eu-central-1:123456789012:execution:orchestrator:OF-TEST-1767261600000';

function executionRow(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    '@timestamp': '2026-01-01 10:00:00.000',
    '@ptr': 'ptr-1',
    '@message': '{"details":{}}',
    'type': 'ExecutionStarted',
    'id': '1',
    'previous_event_id': '0',
    'event_timestamp': '1767261600000',
    'execution_arn': executionArn,
    'redrive_count': '0',
    ...overrides,
  };
}

describe('collectExecutionArns / attachExecutions', () => {
  test('collects the execution_arn values found across all traces', () => {
    const traces = buildReceiverTraces([row({ execution_arn: executionArn })], 'abc-123', 'query-1');
    expect(collectExecutionArns(traces)).toEqual([executionArn]);
  });

  test('leaves executions empty for a trace with no execution_arn', () => {
    const traces = buildReceiverTraces([row()], 'abc-123', 'query-1');
    expect(collectExecutionArns(traces)).toEqual([]);
    expect(attachExecutions(traces, [])[0].executions).toEqual([]);
  });

  test('attaches matching execution events, sorted by id instead of timestamp', () => {
    const traces = buildReceiverTraces([row({ execution_arn: executionArn })], 'abc-123', 'query-1');

    // Identical event_timestamp on purpose: proves the sort uses id, not the tied timestamp.
    const executionRows = [
      executionRow({ id: '2', previous_event_id: '1', type: 'PassStateEntered' }),
      executionRow({ id: '1', previous_event_id: '0', type: 'ExecutionStarted' }),
    ];

    const [trace] = attachExecutions(traces, executionRows);

    expect(trace.executions).toHaveLength(1);
    expect(trace.executions[0].execution_arn).toEqual(executionArn);
    expect(trace.executions[0].events.map(e => e.type)).toEqual(['ExecutionStarted', 'PassStateEntered']);
  });

  test('keeps a known execution_arn with zero matching execution rows as an empty events array', () => {
    const traces = buildReceiverTraces([row({ execution_arn: executionArn })], 'abc-123', 'query-1');
    const [trace] = attachExecutions(traces, []);

    expect(trace.executions).toEqual([{ execution_arn: executionArn, events: [] }]);
  });

  test('maps details, redriveCount, id and previousEventId from the native Step Functions fields', () => {
    const traces = buildReceiverTraces([row({ execution_arn: executionArn })], 'abc-123', 'query-1');
    const executionRows = [executionRow({
      '@message': '{"details":{"name":"Success"}}', 'redrive_count': '1', 'id': '3', 'previous_event_id': '2',
    })];

    const [trace] = attachExecutions(traces, executionRows);
    const [event] = trace.executions[0].events;

    expect(event.details).toEqual({ name: 'Success' });
    expect(event.redriveCount).toEqual(1);
    expect(event.id).toEqual(3);
    expect(event.previousEventId).toEqual(2);
  });

  test('throws QUERY_RESULT_MAPPING_FAILED for an execution row without execution_arn', () => {
    const executionRows = [executionRow({ execution_arn: '' })];
    expect(() => attachExecutions([], executionRows)).toThrow(CloudWatchSubmissionLogReaderError);
  });
});
