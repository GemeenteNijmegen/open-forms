import { CloudWatchLogsClient, GetQueryResultsCommand, StartQueryCommand } from '@aws-sdk/client-cloudwatch-logs';
import { mockClient } from 'aws-sdk-client-mock';
import { CloudWatchSubmissionLogReader } from '../CloudWatchSubmissionLogReader';

describe('CloudWatchSubmissionLogReader.findByObjectUuid', () => {
  const cloudWatchLogsMock = mockClient(CloudWatchLogsClient);
  const range = { fromInclusive: new Date('2026-01-01T00:00:00Z'), toExclusive: new Date('2026-01-02T00:00:00Z') };

  beforeEach(() => {
    cloudWatchLogsMock.reset();
    cloudWatchLogsMock.on(StartQueryCommand).resolves({ queryId: 'query-1' });
  });

  function reader() {
    return new CloudWatchSubmissionLogReader({ cloudWatchLogsClient: new CloudWatchLogsClient({}) });
  }

  test('builds one trace per correlation_id from the receiver rows', async () => {
    cloudWatchLogsMock.on(GetQueryResultsCommand).resolves({
      status: 'Complete',
      results: [
        [
          { field: '@timestamp', value: '2026-01-01 10:00:00.000' },
          { field: 'correlation_id', value: 'correlation-a' },
          { field: 'event', value: 'submission.notification.received' },
          { field: 'objectUuid', value: 'abc-123' },
        ],
        [
          { field: '@timestamp', value: '2026-01-01 10:00:01.000' },
          { field: 'correlation_id', value: 'correlation-a' },
          { field: 'event', value: 'submission.object.fetch.succeeded' },
          { field: 'objectIndex', value: '3' },
        ],
      ],
    });

    const result = await reader().findByObjectUuid({ objectUuid: 'abc-123', range });

    expect(result.lookup).toEqual({ objectUuid: 'abc-123' });
    expect(result.queryRange).toEqual(range);
    expect(result.traces).toHaveLength(1);
    expect(result.traces[0].objectIndexes).toEqual([3]);
    expect(result.traces[0].executions).toEqual([]);
  });

  test('rejects an invalid range before querying CloudWatch', async () => {
    const invalidRange = { fromInclusive: range.toExclusive, toExclusive: range.fromInclusive };

    await expect(reader().findByObjectUuid({ objectUuid: 'abc-123', range: invalidRange }))
      .rejects.toMatchObject({ code: 'INVALID_TIME_RANGE' });

    expect(cloudWatchLogsMock.commandCalls(StartQueryCommand)).toHaveLength(0);
  });
});
