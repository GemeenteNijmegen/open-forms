import { CloudWatchLogsClient, GetQueryResultsCommand, StartQueryCommand } from '@aws-sdk/client-cloudwatch-logs';
import { mockClient } from 'aws-sdk-client-mock';
import { CloudWatchSubmissionLogReader } from '../CloudWatchSubmissionLogReader';

describe('CloudWatchSubmissionLogReader.findByObjectVersion', () => {
  const cloudWatchLogsMock = mockClient(CloudWatchLogsClient);
  const range = { fromInclusive: new Date('2026-01-01T00:00:00Z'), toExclusive: new Date('2026-01-02T00:00:00Z') };

  beforeEach(() => {
    cloudWatchLogsMock.reset();
    cloudWatchLogsMock.on(StartQueryCommand).resolves({ queryId: 'query-1' });
  });

  function reader() {
    return new CloudWatchSubmissionLogReader({ cloudWatchLogsClient: new CloudWatchLogsClient({}) });
  }

  function receiverRow(correlationId: string, objectIndex?: string) {
    return [
      { field: '@timestamp', value: '2026-01-01 10:00:00.000' },
      { field: 'correlation_id', value: correlationId },
      { field: 'event', value: 'submission.notification.received' },
      { field: 'objectUuid', value: 'abc-123' },
      ...(objectIndex ? [{ field: 'objectIndex', value: objectIndex }] : []),
    ];
  }

  test('reuses the UUID read and categorizes the traces by the requested objectIndex', async () => {
    cloudWatchLogsMock.on(GetQueryResultsCommand).resolves({
      status: 'Complete',
      results: [
        receiverRow('A', '1'),
        receiverRow('B'),
        receiverRow('C', '3'),
      ],
    });

    const result = await reader().findByObjectVersion({ objectUuid: 'abc-123', objectIndex: 3, range });

    expect(result.lookup).toEqual({ objectUuid: 'abc-123', objectIndex: 3 });
    expect(result.queryRange).toEqual(range);
    expect(result.tracesForRequestedIndex.map(t => t.correlation_id)).toEqual(['C']);
    expect(result.tracesWithoutObjectIndex.map(t => t.correlation_id)).toEqual(['B']);
    expect(result.tracesForOtherIndexes.map(t => t.correlation_id)).toEqual(['A']);
    expect(result.otherTraces).toEqual([]);

    // Same single receiver query as findByObjectUuid, no separate lookup implementation underneath.
    expect(cloudWatchLogsMock.commandCalls(StartQueryCommand)).toHaveLength(1);
  });
});
