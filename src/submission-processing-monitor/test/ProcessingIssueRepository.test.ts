import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { ProcessingIssueRepository } from '../dynamodb/ProcessingIssueRepository';
import { ProcessingResult } from '../model/ProcessingResult';

const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

function problemResult(overrides: Partial<ProcessingResult> & { objectUuid: string; objectIndex: number }): ProcessingResult {
  return {
    objectType: 'https://example.com/objecttypes/api/v2/objecttypes/d3713c2b-307c-4c07-8eaa-c2c6d75869cf',
    processingKind: 'REGULAR',
    registrationAt: '2026-08-27',
    status: 'FAILED',
    matchType: 'UNIQUE',
    ...overrides,
  };
}

describe('ProcessingIssueRepository', () => {
  const dynamoMock = mockClient(DynamoDBDocumentClient);
  const repository = new ProcessingIssueRepository('processing-issues-table');

  beforeEach(() => {
    dynamoMock.reset();
  });

  test('upserts the same objectUuid/objectIndex idempotently: firstDetectedAt is preserved via if_not_exists while lastCheckedAt, lastRunId and ttl refresh', async () => {
    dynamoMock.on(UpdateCommand).resolves({});
    const result = problemResult({ objectUuid: 'uuid-1', objectIndex: 1, reference: 'OF-A0001' });

    await repository.recordProblem(result, { runId: 'run-1', checkedAt: new Date('2026-08-27T06:00:00Z') });
    await repository.recordProblem(result, { runId: 'run-2', checkedAt: new Date('2026-08-28T06:00:00Z') });

    const calls = dynamoMock.commandCalls(UpdateCommand);
    expect(calls).toHaveLength(2);
    expect(calls[0].args[0].input.Key).toEqual({ PK: 'OBJECT#uuid-1', SK: 'INDEX#000001' });
    expect(calls[1].args[0].input.Key).toEqual(calls[0].args[0].input.Key);
    for (const call of calls) {
      expect(call.args[0].input.UpdateExpression).toContain('firstDetectedAt = if_not_exists(firstDetectedAt, :lastCheckedAt)');
    }

    expect(calls[0].args[0].input.ExpressionAttributeValues![':lastRunId']).toBe('run-1');
    expect(calls[1].args[0].input.ExpressionAttributeValues![':lastRunId']).toBe('run-2');
    expect(calls[0].args[0].input.ExpressionAttributeValues![':lastCheckedAt']).toBe('2026-08-27T06:00:00.000Z');
    expect(calls[1].args[0].input.ExpressionAttributeValues![':lastCheckedAt']).toBe('2026-08-28T06:00:00.000Z');
  });

  test('sets ttl 90 days after lastCheckedAt on every update', async () => {
    dynamoMock.on(UpdateCommand).resolves({});
    const checkedAt = new Date('2026-08-27T06:00:00Z');

    await repository.recordProblem(problemResult({ objectUuid: 'uuid-2', objectIndex: 1 }), { runId: 'run-1', checkedAt });

    const call = dynamoMock.commandCalls(UpdateCommand)[0];
    expect(call.args[0].input.ExpressionAttributeValues![':ttl']).toBe(Math.floor(checkedAt.getTime() / 1000) + NINETY_DAYS_SECONDS);
  });

  test('allows the same reference on more than one ProcessingIssue - reference is not the identity', async () => {
    dynamoMock.on(UpdateCommand).resolves({});
    const context = { runId: 'run-1', checkedAt: new Date('2026-08-27T06:00:00Z') };

    await repository.recordProblem(problemResult({ objectUuid: 'uuid-d', objectIndex: 1, reference: 'OF-DUP01' }), context);
    await repository.recordProblem(problemResult({ objectUuid: 'uuid-e', objectIndex: 1, reference: 'OF-DUP01' }), context);

    const calls = dynamoMock.commandCalls(UpdateCommand);
    expect(calls[0].args[0].input.Key).not.toEqual(calls[1].args[0].input.Key);
    expect(calls[0].args[0].input.ExpressionAttributeValues![':reference']).toBe('OF-DUP01');
    expect(calls[1].args[0].input.ExpressionAttributeValues![':reference']).toBe('OF-DUP01');
  });

  test('resolves an existing issue when a later reliable check succeeds, refreshing ttl and recording the successful execution', async () => {
    dynamoMock.on(UpdateCommand).resolves({});
    const succeeded = problemResult({ objectUuid: 'uuid-1', objectIndex: 1, status: 'SUCCEEDED', executionArn: 'arn:exec:ok' });
    const checkedAt = new Date('2026-09-01T06:00:00Z');

    await repository.recordResolved(succeeded, { runId: 'run-3', checkedAt });

    const call = dynamoMock.commandCalls(UpdateCommand)[0];
    expect(call.args[0].input.ConditionExpression).toBe('attribute_exists(PK)');
    expect(call.args[0].input.ExpressionAttributeValues![':recoveryStatus']).toBe('RESOLVED');
    expect(call.args[0].input.ExpressionAttributeValues![':resolvedAt']).toBe('2026-09-01T06:00:00.000Z');
    expect(call.args[0].input.ExpressionAttributeValues![':successfulExecutionArn']).toBe('arn:exec:ok');
    expect(call.args[0].input.ExpressionAttributeValues![':ttl']).toBe(Math.floor(checkedAt.getTime() / 1000) + NINETY_DAYS_SECONDS);
    expect(dynamoMock.commandCalls(DeleteCommand)).toHaveLength(0);
  });

  test('does not create a new issue when resolving a record that has no existing open issue', async () => {
    dynamoMock.on(UpdateCommand).rejects(new ConditionalCheckFailedException({ message: 'The conditional request failed', $metadata: {} }));
    const succeeded = problemResult({ objectUuid: 'uuid-9', objectIndex: 1, status: 'SUCCEEDED' });

    await expect(
      repository.recordResolved(succeeded, { runId: 'run-1', checkedAt: new Date('2026-08-27T06:00:00Z') }),
    ).resolves.toBeUndefined();
  });
});
