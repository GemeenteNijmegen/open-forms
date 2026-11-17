import { CloudWatchLogsClient, GetQueryResultsCommand, StartQueryCommand } from '@aws-sdk/client-cloudwatch-logs';
import { mockClient } from 'aws-sdk-client-mock';
import { CloudWatchSubmissionLogReader } from '../CloudWatchSubmissionLogReader';
import orchestratorSucceeded from './samples/orchestrator/succeeded.json';
import receiverHappyFlow from './samples/receiver/happy-flow.json';

// Samples are plain CWLI rows (Record<string, string>); CloudWatch itself returns field/value pairs.
function asResultFields(rows: Record<string, string>[]) {
  return rows.map(row => Object.entries(row).map(([field, value]) => ({ field, value })));
}

describe('happy flow (real accp sample data)', () => {
  const cloudWatchLogsMock = mockClient(CloudWatchLogsClient);
  const range = { fromInclusive: new Date('2026-11-02T00:00:00Z'), toExclusive: new Date('2026-11-03T00:00:00Z') };

  beforeEach(() => {
    cloudWatchLogsMock.reset();
    cloudWatchLogsMock.on(StartQueryCommand).resolves({ queryId: 'query-1' });
  });

  test('builds one complete trace with a matching execution for a real submission', async () => {
    cloudWatchLogsMock
      .on(GetQueryResultsCommand)
      .resolvesOnce({ status: 'Complete', results: asResultFields(receiverHappyFlow as Record<string, string>[]) })
      .resolvesOnce({ status: 'Complete', results: asResultFields(orchestratorSucceeded as Record<string, string>[]) });

    const reader = new CloudWatchSubmissionLogReader({ cloudWatchLogsClient: new CloudWatchLogsClient({}) });
    const result = await reader.findByObjectUuid({ objectUuid: '37119935-86ce-4fdf-8f4d-cddf9f232068', range });

    expect(result.traces).toHaveLength(1);
    const [trace] = result.traces;

    expect(trace.objectIndexes).toEqual([1]);
    expect(trace.receiverEvents).toHaveLength(6);
    expect(trace.receiverEvents.map(e => e.event)).toEqual([
      'submission.notification.received',
      'submission.object.fetch.started',
      'submission.object.fetch.succeeded',
      'submission.object.parsed',
      'submission.execution.starting',
      'submission.execution.started',
    ]);

    const fetchSucceeded = trace.receiverEvents[2];
    expect(fetchSucceeded.formName).toEqual('Bingo melden of loterijvergunning aanvragen');
    expect(fetchSucceeded.objectTypeUrl).toEqual(
      'https://mijn-services.accp.nijmegen.nl/objects/api/v2/objecttypes/167e0aec-e416-46fa-9868-e35f11f3f151',
    );

    const parsed = trace.receiverEvents[3];
    expect(parsed.reference).toEqual('OF-9DNFG3');

    expect(trace.executions).toHaveLength(1);
    const events = trace.executions[0].events;
    expect(events).toHaveLength(25);

    const started = events[0];
    expect(started.type).toEqual('ExecutionStarted');
    expect(started.previousEventId).toEqual(0);
    expect(started.redriveCount).toEqual(0);
    expect(started.details).toEqual({ roleArn: 'arn:aws:iam::043309345347:role/open-forms-main-stack-submissionforwarderorchestrat-EM6rI6l4oBR6' });

    const forwarded = events.find(e => e.id === 18);
    expect(forwarded?.type).toEqual('TaskStateEntered');
    expect(forwarded?.previousEventId).toEqual(17);
    expect(forwarded?.details).toEqual({ name: 'VIP/JZ4ALL forward' });

    const succeeded = events[24];
    expect(succeeded.type).toEqual('ExecutionSucceeded');
    expect(succeeded.previousEventId).toEqual(24);
    expect(succeeded.details).toEqual({});
  });
});
