import { CloudWatchSubmissionLogReaderError } from '../../errors/CloudWatchSubmissionLogReaderError';
import { buildReceiverTraces } from '../SubmissionTraceBuilder';

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
