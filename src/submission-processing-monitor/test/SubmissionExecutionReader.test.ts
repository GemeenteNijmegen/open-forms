import { DescribeExecutionCommand, ExecutionStatus, ListExecutionsCommand, SFNClient } from '@aws-sdk/client-sfn';
import { mockClient } from 'aws-sdk-client-mock';
import { SubmissionExecutionReader } from '../executions/SubmissionExecutionReader';
import { RuntimeBudget } from '../RuntimeBudget';

function exhaustedBudget(): RuntimeBudget {
  return new RuntimeBudget(() => 0);
}

const STATE_MACHINE_ARN = 'arn:aws:states:eu-central-1:123456789012:stateMachine:submission-forwarder-orchestrator';

function executionListItem(executionArn: string, status: ExecutionStatus, startDate: string) {
  return {
    executionArn,
    stateMachineArn: STATE_MACHINE_ARN,
    name: executionArn,
    status,
    startDate: new Date(startDate),
  };
}

describe('SubmissionExecutionReader', () => {
  const sfnMock = mockClient(SFNClient);

  beforeEach(() => {
    sfnMock.reset();
  });

  test('lists executions and follows the nextToken for pagination', async () => {
    sfnMock
      .on(ListExecutionsCommand, { stateMachineArn: STATE_MACHINE_ARN })
      .resolvesOnce({
        executions: [executionListItem('arn:exec:1', 'SUCCEEDED', '2026-08-27T10:00:00Z')],
        nextToken: 'page-2',
      })
      .resolvesOnce({
        executions: [executionListItem('arn:exec:2', 'FAILED', '2026-08-27T11:00:00Z')],
      });

    const reader = new SubmissionExecutionReader(STATE_MACHINE_ARN);
    const firstPage = await reader.listExecutionsPage();
    const secondPage = await reader.listExecutionsPage(firstPage.nextToken);

    expect(firstPage.executions).toEqual([
      { executionArn: 'arn:exec:1', name: 'arn:exec:1', status: 'SUCCEEDED', startDate: new Date('2026-08-27T10:00:00Z'), stopDate: undefined },
    ]);
    expect(firstPage.nextToken).toBe('page-2');
    expect(secondPage.executions[0].status).toBe('FAILED');
    expect(secondPage.nextToken).toBeUndefined();

    expect(sfnMock.commandCalls(ListExecutionsCommand)[1].args[0].input.nextToken).toBe('page-2');
  });

  test('never calls StartExecution, StopExecution or RedriveExecution', async () => {
    sfnMock.on(ListExecutionsCommand).resolves({ executions: [] });
    const reader = new SubmissionExecutionReader(STATE_MACHINE_ARN);
    await reader.listExecutionsPage();

    expect(sfnMock.calls().every(call => {
      const commandName = call.args[0].constructor.name;
      return !['StartExecutionCommand', 'StopExecutionCommand', 'RedriveExecutionCommand'].includes(commandName);
    })).toBe(true);
  });

  test('extracts only objectUuid and reference from the execution input', async () => {
    sfnMock.on(DescribeExecutionCommand).resolves({
      input: JSON.stringify({
        objectUUID: '714eb3e8-2db1-4da2-bacd-c2c08187ceaf',
        reference: 'OF-XN6DEA',
        pdf: 'https://domein.nl/open-zaak/documenten/api/v1/enkelvoudiginformatieobjecten/00000000-0000-0000-0000-000000000001',
        attachments: [],
      }),
    });

    const reader = new SubmissionExecutionReader(STATE_MACHINE_ARN);
    const details = await reader.describeExecution('arn:exec:1');

    expect(details).toMatchObject({ objectUuid: '714eb3e8-2db1-4da2-bacd-c2c08187ceaf', reference: 'OF-XN6DEA' });
  });

  test('returns no objectUuid/reference when the execution has no input, without throwing', async () => {
    sfnMock.on(DescribeExecutionCommand).resolves({});
    const reader = new SubmissionExecutionReader(STATE_MACHINE_ARN);
    const details = await reader.describeExecution('arn:exec:1');

    expect(details.objectUuid).toBeUndefined();
    expect(details.reference).toBeUndefined();
  });

  test('includes error, cause and redrive details for a failed execution', async () => {
    sfnMock.on(DescribeExecutionCommand).resolves({
      error: 'States.TaskFailed',
      cause: 'Lambda function returned a non-2xx status code',
      redriveStatus: 'REDRIVABLE',
      redriveCount: 1,
      redriveDate: new Date('2026-08-27T09:00:00Z'),
    });

    const reader = new SubmissionExecutionReader(STATE_MACHINE_ARN);
    const details = await reader.describeExecution('arn:exec:1');

    expect(details).toMatchObject({
      error: 'States.TaskFailed',
      cause: 'Lambda function returned a non-2xx status code',
      redriveStatus: 'REDRIVABLE',
      redriveCount: 1,
      redriveDate: new Date('2026-08-27T09:00:00Z'),
    });
  });

  describe('listExecutionsInPeriod', () => {
    // period.to is a calendar date, not the scan window's upper bound: an object registered just
    // before period.to can have its execution start seconds later, already past period.to.
    const period = { from: '2026-08-26', to: '2026-08-27' };
    const monitorRunStartedAt = new Date('2026-08-27T04:00:00Z'); // e.g. the 06:00 Europe/Amsterdam scheduled run

    test('includes an execution that starts after period.to but before the monitor run started', async () => {
      sfnMock.on(ListExecutionsCommand).resolvesOnce({
        executions: [executionListItem('arn:after-period-to', 'SUCCEEDED', '2026-08-27T00:30:00Z')],
      });

      const reader = new SubmissionExecutionReader(STATE_MACHINE_ARN);
      const { executions } = await reader.listExecutionsInPeriod(period, monitorRunStartedAt);

      expect(executions.map(e => e.executionArn)).toEqual(['arn:after-period-to']);
    });

    test('excludes an execution that starts after the monitor run started', async () => {
      sfnMock.on(ListExecutionsCommand).resolvesOnce({
        executions: [executionListItem('arn:after-run-start', 'SUCCEEDED', '2026-08-27T05:00:00Z')],
      });

      const reader = new SubmissionExecutionReader(STATE_MACHINE_ARN);
      const { executions } = await reader.listExecutionsInPeriod(period, monitorRunStartedAt);

      expect(executions).toHaveLength(0);
    });

    test('stops paging once an execution is provably older than period.from, without fetching further pages', async () => {
      sfnMock.on(ListExecutionsCommand).resolvesOnce({
        executions: [
          executionListItem('arn:in-period', 'SUCCEEDED', '2026-08-26T12:00:00Z'),
          executionListItem('arn:too-old', 'SUCCEEDED', '2026-08-20T12:00:00Z'),
        ],
        nextToken: 'page-2', // must never be requested
      });

      const reader = new SubmissionExecutionReader(STATE_MACHINE_ARN);
      const { executions } = await reader.listExecutionsInPeriod(period, monitorRunStartedAt);

      expect(executions.map(e => e.executionArn)).toEqual(['arn:in-period']);
      expect(sfnMock.commandCalls(ListExecutionsCommand)).toHaveLength(1);
    });

    test('follows pagination across multiple pages while every execution is still within the scan window', async () => {
      sfnMock
        .on(ListExecutionsCommand)
        .resolvesOnce({
          executions: [executionListItem('arn:page-1', 'SUCCEEDED', '2026-08-26T20:00:00Z')],
          nextToken: 'page-2',
        })
        .resolvesOnce({
          executions: [executionListItem('arn:page-2', 'SUCCEEDED', '2026-08-26T08:00:00Z')],
        });

      const reader = new SubmissionExecutionReader(STATE_MACHINE_ARN);
      const { executions } = await reader.listExecutionsInPeriod(period, monitorRunStartedAt);

      expect(executions.map(e => e.executionArn).sort()).toEqual(['arn:page-1', 'arn:page-2']);
    });
  });

  test('listExecutionsWithMetadata attaches the objectUuid from each execution\'s describeExecution call', async () => {
    sfnMock.on(ListExecutionsCommand).resolvesOnce({
      executions: [executionListItem('arn:exec:1', 'SUCCEEDED', '2026-08-26T12:00:00Z')],
    });
    sfnMock.on(DescribeExecutionCommand, { executionArn: 'arn:exec:1' }).resolves({
      input: JSON.stringify({ objectUUID: '714eb3e8-2db1-4da2-bacd-c2c08187ceaf', reference: 'OF-XN6DEA' }),
    });

    const reader = new SubmissionExecutionReader(STATE_MACHINE_ARN);
    const { executions, complete } = await reader.listExecutionsWithMetadata({ from: '2026-08-26', to: '2026-08-27' }, new Date('2026-08-27T04:00:00Z'));

    expect(executions).toEqual([expect.objectContaining({ executionArn: 'arn:exec:1', objectUuid: '714eb3e8-2db1-4da2-bacd-c2c08187ceaf' })]);
    expect(complete).toBe(true);
  });

  describe('runtime budget and DescribeExecution concurrency', () => {
    const period = { from: '2026-08-26', to: '2026-08-27' };
    const monitorRunStartedAt = new Date('2026-08-27T04:00:00Z');

    test('listExecutionsInPeriod reports complete: false and stops paging once the runtime budget runs out', async () => {
      sfnMock.on(ListExecutionsCommand).resolvesOnce({
        executions: [executionListItem('arn:page-1', 'SUCCEEDED', '2026-08-26T20:00:00Z')],
        nextToken: 'page-2', // must never be requested
      });

      const reader = new SubmissionExecutionReader(STATE_MACHINE_ARN);
      const result = await reader.listExecutionsInPeriod(period, monitorRunStartedAt, exhaustedBudget());

      expect(result).toEqual({ executions: [], complete: false });
      expect(sfnMock.commandCalls(ListExecutionsCommand)).toHaveLength(0);
    });

    test('listExecutionsWithMetadata calls DescribeExecution in bounded batches and stops once the runtime budget runs out mid-scan', async () => {
      sfnMock.on(ListExecutionsCommand).resolvesOnce({
        executions: [
          executionListItem('arn:exec:1', 'SUCCEEDED', '2026-08-26T20:00:00Z'),
          executionListItem('arn:exec:2', 'SUCCEEDED', '2026-08-26T19:00:00Z'),
          executionListItem('arn:exec:3', 'SUCCEEDED', '2026-08-26T18:00:00Z'),
        ],
      });
      sfnMock.on(DescribeExecutionCommand).resolves({});

      // concurrency 2: batch 1 = [exec:1, exec:2], batch 2 = [exec:3]
      const reader = new SubmissionExecutionReader(STATE_MACHINE_ARN, { describeExecutionConcurrency: 2 });
      let calls = 0;
      const runtimeBudget = new RuntimeBudget(() => {
        calls += 1;
        // Time remains for the list call and the first DescribeExecution batch, runs out right after.
        return calls <= 2 ? 300_000 : 0;
      });

      const result = await reader.listExecutionsWithMetadata(period, monitorRunStartedAt, runtimeBudget);

      expect(result.complete).toBe(false);
      expect(result.executions.map(e => e.executionArn)).toEqual(['arn:exec:1', 'arn:exec:2']);
      expect(sfnMock.commandCalls(DescribeExecutionCommand)).toHaveLength(2);
    });
  });
});
