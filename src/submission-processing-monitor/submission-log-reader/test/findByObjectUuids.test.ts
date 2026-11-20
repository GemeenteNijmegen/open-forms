import { CloudWatchLogsClient, GetQueryResultsCommand, StartQueryCommand } from '@aws-sdk/client-cloudwatch-logs';
import { mockClient } from 'aws-sdk-client-mock';
import { CloudWatchSubmissionLogReader } from '../CloudWatchSubmissionLogReader';

// CloudWatch is replaced by a fake that answers per query. A receiver query gets the queryId of the objectUuids it looks for, so each test
// says per group what CloudWatch answers.
describe('CloudWatchSubmissionLogReader.findByObjectUuids', () => {
  const cloudWatchLogsMock = mockClient(CloudWatchLogsClient);
  const range = { fromInclusive: new Date('2026-01-01T00:00:00Z'), toExclusive: new Date('2026-01-02T00:00:00Z') };

  function receiverRow(objectUuid: string, correlationId: string) {
    return [
      { field: '@timestamp', value: '2026-01-01 10:00:00.000' },
      { field: 'correlation_id', value: correlationId },
      { field: 'event', value: 'submission.notification.received' },
      { field: 'objectUuid', value: objectUuid },
    ];
  }

  // answers: per query (the objectUuids joined with a comma) what GetQueryResults gives.
  function answerQueries(answers: Record<string, object>) {
    cloudWatchLogsMock.on(StartQueryCommand).callsFake((input) => {
      const objectUuids = [...input.queryString.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
      return { queryId: objectUuids.join(',') };
    });
    cloudWatchLogsMock.on(GetQueryResultsCommand).callsFake((input) => {
      const answer = answers[input.queryId];
      if (!answer) {
        throw new Error(`No answer for query ${input.queryId}`);
      }
      return answer;
    });
  }

  function reader() {
    return new CloudWatchSubmissionLogReader({ cloudWatchLogsClient: new CloudWatchLogsClient({}) });
  }

  beforeEach(() => {
    cloudWatchLogsMock.reset();
  });

  test('reads a group in one query and gives each objectUuid its own traces', async () => {
    answerQueries({
      'uuid-a,uuid-b,uuid-c': {
        status: 'Complete',
        results: [receiverRow('uuid-a', 'correlation-a'), receiverRow('uuid-c', 'correlation-c'), receiverRow('uuid-a', 'correlation-a2')],
      },
    });

    const reads = await reader().findByObjectUuids({ objectUuids: ['uuid-a', 'uuid-b', 'uuid-c'], range, shouldStop: () => false });

    expect(cloudWatchLogsMock.commandCalls(StartQueryCommand)).toHaveLength(1);
    expect(reads.failedReads).toEqual([]);
    const tracesPerObject = reads.logs.map((logs) => [logs.lookup.objectUuid, logs.traces.map((trace) => trace.correlation_id)]);
    expect(tracesPerObject).toEqual([['uuid-a', ['correlation-a', 'correlation-a2']], ['uuid-b', []], ['uuid-c', ['correlation-c']]]);
  });

  test('splits a group in halves when its results are incomplete', async () => {
    answerQueries({
      'uuid-a,uuid-b': { status: 'Complete', results: [receiverRow('uuid-a', 'correlation-a'), receiverRow('uuid-b', 'correlation-b')] },
      'uuid-c,uuid-d': { status: 'Complete', results: [receiverRow('uuid-c', 'correlation-c'), receiverRow('uuid-d', 'correlation-d')] },
    });
    // The first page of the whole group says there is more, and the next page fails: the results of the group are incomplete.
    cloudWatchLogsMock.on(GetQueryResultsCommand, { queryId: 'uuid-a,uuid-b,uuid-c,uuid-d' })
      .resolvesOnce({ status: 'Complete', results: [receiverRow('uuid-a', 'correlation-a')], nextToken: 'page-2' })
      .rejectsOnce(new Error('page 2 failed'));

    const objectUuids = ['uuid-a', 'uuid-b', 'uuid-c', 'uuid-d'];
    const reads = await reader().findByObjectUuids({ objectUuids, range, shouldStop: () => false });

    // One query for the group, then one per half; reading one by one would have taken four.
    expect(cloudWatchLogsMock.commandCalls(StartQueryCommand)).toHaveLength(3);
    expect(reads.failedReads).toEqual([]);
    expect(reads.logs.map((logs) => logs.lookup.objectUuid)).toEqual(objectUuids);
  });

  test('reads a failed group one by one, so only the objectUuid that keeps failing is a failed read', async () => {
    answerQueries({
      'uuid-a,uuid-b': { status: 'Failed' },
      'uuid-a': { status: 'Complete', results: [receiverRow('uuid-a', 'correlation-a')] },
      'uuid-b': { status: 'Failed' },
    });

    const reads = await reader().findByObjectUuids({ objectUuids: ['uuid-a', 'uuid-b'], range, shouldStop: () => false });

    expect(reads.logs.map((logs) => logs.lookup.objectUuid)).toEqual(['uuid-a']);
    expect(reads.failedReads.map((failedRead) => failedRead.objectUuid)).toEqual(['uuid-b']);
  });
});
