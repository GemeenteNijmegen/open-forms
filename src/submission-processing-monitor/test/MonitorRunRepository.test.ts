import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { MonitorRunRepository } from '../dynamodb/MonitorRunRepository';
import { MonitorRun } from '../model/MonitorRun';

const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

describe('MonitorRunRepository', () => {
  const dynamoMock = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    dynamoMock.reset();
    jest.useFakeTimers({ now: new Date('2026-08-28T04:05:00.000Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('saves a compact run summary with a native ttl 90 days after save() is called', async () => {
    dynamoMock.on(PutCommand).resolves({});
    const repository = new MonitorRunRepository('monitor-runs-table');
    const run: MonitorRun = {
      runId: 'run-1',
      periodFrom: '2026-08-27',
      periodTo: '2026-08-28',
      startedAt: '2026-08-28T04:00:00.000Z',
      completedAt: '2026-08-28T04:05:00.000Z',
      status: 'COMPLETED',
      objectsScanned: 9,
      objectRecordsFound: 9,
      executionsScanned: 5,
      regularCounters: { total: 5, succeeded: 3, problem: 2 },
      esfCounters: { open: 1, verwerkt: 1, gesloten: 1, afgerond: 1, afgerondSucceeded: 1, afgerondProblem: 0, invalid: 0 },
      problemCount: 2,
    };

    await repository.save(run);

    const call = dynamoMock.commandCalls(PutCommand)[0];
    expect(call.args[0].input.TableName).toBe('monitor-runs-table');
    expect(call.args[0].input.Item).toMatchObject(run);
    expect(call.args[0].input.Item!.ttl).toBe(Math.floor(Date.now() / 1000) + NINETY_DAYS_SECONDS);
  });

  test('saves an INCOMPLETE run with its failureReason, unconditionally', async () => {
    dynamoMock.on(PutCommand).resolves({});
    const repository = new MonitorRunRepository('monitor-runs-table');
    const run: MonitorRun = {
      runId: 'run-2',
      periodFrom: '2026-08-27',
      periodTo: '2026-08-28',
      startedAt: '2026-08-28T04:00:00.000Z',
      completedAt: '2026-08-28T04:14:00.000Z',
      status: 'INCOMPLETE',
      failureReason: 'Stopped before the safe runtime limit with the executions scan still in progress',
      objectsScanned: 9,
      objectRecordsFound: 9,
      executionsScanned: 0,
      regularCounters: { total: 0, succeeded: 0, problem: 0 },
      esfCounters: { open: 0, verwerkt: 0, gesloten: 0, afgerond: 0, afgerondSucceeded: 0, afgerondProblem: 0, invalid: 0 },
      problemCount: 0,
    };

    await repository.save(run);

    expect(dynamoMock.commandCalls(PutCommand)[0].args[0].input.Item).toMatchObject({ status: 'INCOMPLETE', failureReason: run.failureReason });
  });
});
