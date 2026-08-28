import { DescribeExecutionCommand, ExecutionStatus, ListExecutionsCommand, SFNClient } from '@aws-sdk/client-sfn';
import { mockClient } from 'aws-sdk-client-mock';
import { SubmissionExecutionReader } from '../executions/SubmissionExecutionReader';

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
        pdf: 'https://mijn-services.accp.nijmegen.nl/open-zaak/documenten/api/v1/enkelvoudiginformatieobjecten/00000000-0000-0000-0000-000000000001',
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
    test('skips executions newer than the period, keeps ones inside it, and stops once older than the period, without fetching further pages', async () => {
      sfnMock.on(ListExecutionsCommand).resolvesOnce({
        executions: [
          executionListItem('arn:today', 'SUCCEEDED', '2026-08-27T23:00:00Z'), // newer than the period, skip
          executionListItem('arn:in-period', 'SUCCEEDED', '2026-08-26T12:00:00Z'), // inside the period, keep
          executionListItem('arn:too-old', 'SUCCEEDED', '2026-08-20T12:00:00Z'), // older than the period, stop here
        ],
        nextToken: 'page-2', // must never be requested
      });

      const reader = new SubmissionExecutionReader(STATE_MACHINE_ARN);
      const executions = await reader.listExecutionsInPeriod({ from: '2026-08-26', to: '2026-08-27' });

      expect(executions.map(e => e.executionArn)).toEqual(['arn:in-period']);
      expect(sfnMock.commandCalls(ListExecutionsCommand)).toHaveLength(1);
    });

    test('follows pagination across multiple pages while every execution is still in or after the period', async () => {
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
      const executions = await reader.listExecutionsInPeriod({ from: '2026-08-26', to: '2026-08-27' });

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
    const executions = await reader.listExecutionsWithMetadata({ from: '2026-08-26', to: '2026-08-27' });

    expect(executions).toEqual([expect.objectContaining({ executionArn: 'arn:exec:1', objectUuid: '714eb3e8-2db1-4da2-bacd-c2c08187ceaf' })]);
  });
});
