import { CloudWatchLogsClient, GetQueryResultsCommand, StartQueryCommand, StopQueryCommand } from '@aws-sdk/client-cloudwatch-logs';
import { mockClient } from 'aws-sdk-client-mock';
import { CloudWatchLogsQueryRunner, CloudWatchLogsQueryRunnerOptions, CwliQueryRequest } from '../CloudWatchLogsQueryRunner';

describe('CloudWatchLogsQueryRunner', () => {
  const cloudWatchLogsMock = mockClient(CloudWatchLogsClient);

  const request: CwliQueryRequest = {
    queryString: "SOURCE logGroupTags([{'key':'OpenFormsLog','values':['submission-forwarder-receiver']}]) | fields @timestamp",
    range: { fromInclusive: new Date('2026-01-01T00:00:00Z'), toExclusive: new Date('2026-01-02T00:00:00Z') },
    stage: 'receiver-query',
  };

  beforeEach(() => {
    cloudWatchLogsMock.reset();
    cloudWatchLogsMock.on(StartQueryCommand).resolves({ queryId: 'query-1' });
  });

  function runner(overrides?: Partial<CloudWatchLogsQueryRunnerOptions>) {
    return new CloudWatchLogsQueryRunner({
      cloudWatchLogsClient: new CloudWatchLogsClient({}),
      pollIntervalMs: 1,
      timeoutMs: 50,
      ...overrides,
    });
  }

  test('translates the half-open range into inclusive epoch-second bounds', async () => {
    cloudWatchLogsMock.on(GetQueryResultsCommand).resolves({ status: 'Complete', results: [] });

    await runner().run(request);

    const [startQueryCall] = cloudWatchLogsMock.commandCalls(StartQueryCommand);
    expect(startQueryCall.args[0].input).toMatchObject({
      startTime: Date.parse('2026-01-01T00:00:00Z') / 1000,
      endTime: Date.parse('2026-01-02T00:00:00Z') / 1000 - 1,
    });
  });

  test('returns rows once the query is Complete', async () => {
    cloudWatchLogsMock.on(GetQueryResultsCommand).resolves({
      status: 'Complete',
      results: [[{ field: '@timestamp', value: '2026-01-01 00:00:00.000' }, { field: 'objectUuid', value: 'abc' }]],
      statistics: { recordsMatched: 1 },
    });

    const result = await runner().run(request);

    expect(result).toEqual({
      rows: [{ '@timestamp': '2026-01-01 00:00:00.000', 'objectUuid': 'abc' }],
      queryId: 'query-1',
      statistics: { recordsMatched: 1 },
    });
  });

  test('follows nextToken to collect every page after Complete', async () => {
    cloudWatchLogsMock
      .on(GetQueryResultsCommand, { queryId: 'query-1', nextToken: undefined })
      .resolves({ status: 'Complete', results: [[{ field: 'objectUuid', value: 'page-1' }]], nextToken: 'token-2' })
      .on(GetQueryResultsCommand, { queryId: 'query-1', nextToken: 'token-2' })
      .resolves({ status: 'Complete', results: [[{ field: 'objectUuid', value: 'page-2' }]] });

    const result = await runner().run(request);

    expect(result.rows).toEqual([{ objectUuid: 'page-1' }, { objectUuid: 'page-2' }]);
  });

  test('polls until a terminal status is reached', async () => {
    cloudWatchLogsMock
      .on(GetQueryResultsCommand)
      .resolvesOnce({ status: 'Running' })
      .resolvesOnce({ status: 'Scheduled' })
      .resolvesOnce({ status: 'Complete', results: [] });

    const result = await runner().run(request);

    expect(result.rows).toEqual([]);
    expect(cloudWatchLogsMock.commandCalls(GetQueryResultsCommand)).toHaveLength(3);
  });

  test.each([
    ['Failed', 'QUERY_FAILED'],
    ['Cancelled', 'QUERY_CANCELLED'],
    ['Timeout', 'QUERY_TIMEOUT'],
  ] as const)('maps CWLI status %s to %s', async (status, code) => {
    cloudWatchLogsMock.on(GetQueryResultsCommand).resolves({ status });

    await expect(runner().run(request)).rejects.toMatchObject({ code, context: { queryId: 'query-1', queryStatus: status } });
  });

  test('stops the query and throws QUERY_TIMEOUT when the local deadline passes', async () => {
    cloudWatchLogsMock.on(GetQueryResultsCommand).resolves({ status: 'Running' });
    cloudWatchLogsMock.on(StopQueryCommand).resolves({ success: true });

    await expect(runner().run(request)).rejects.toMatchObject({ code: 'QUERY_TIMEOUT', context: { queryId: 'query-1' } });
    expect(cloudWatchLogsMock.commandCalls(StopQueryCommand)).toHaveLength(1);
  });

  test('throws QUERY_START_FAILED when StartQuery returns no queryId', async () => {
    cloudWatchLogsMock.on(StartQueryCommand).resolves({});

    await expect(runner().run(request)).rejects.toMatchObject({ code: 'QUERY_START_FAILED' });
  });

  test('throws QUERY_START_FAILED when StartQuery itself fails', async () => {
    cloudWatchLogsMock.on(StartQueryCommand).rejects(new Error('boom'));

    await expect(runner().run(request)).rejects.toMatchObject({ code: 'QUERY_START_FAILED' });
  });

  test('throws QUERY_RESULTS_FAILED when GetQueryResults itself fails', async () => {
    cloudWatchLogsMock.on(GetQueryResultsCommand).rejects(new Error('boom'));

    await expect(runner().run(request)).rejects.toMatchObject({ code: 'QUERY_RESULTS_FAILED' });
  });

  test('throws QUERY_RESULTS_INCOMPLETE instead of returning partial rows when pagination fails', async () => {
    cloudWatchLogsMock
      .on(GetQueryResultsCommand, { queryId: 'query-1', nextToken: undefined })
      .resolves({ status: 'Complete', results: [[{ field: 'objectUuid', value: 'page-1' }]], nextToken: 'token-2' })
      .on(GetQueryResultsCommand, { queryId: 'query-1', nextToken: 'token-2' })
      .rejects(new Error('boom'));

    await expect(runner().run(request)).rejects.toMatchObject({ code: 'QUERY_RESULTS_INCOMPLETE' });
  });

  test('throws QUERY_RESULT_LIMIT_REACHED when the row count reaches the requested limit', async () => {
    cloudWatchLogsMock.on(GetQueryResultsCommand).resolves({
      status: 'Complete',
      results: [[{ field: 'objectUuid', value: 'a' }], [{ field: 'objectUuid', value: 'b' }]],
    });

    await expect(runner().run({ ...request, limit: 2 })).rejects.toMatchObject({ code: 'QUERY_RESULT_LIMIT_REACHED' });
  });
});
