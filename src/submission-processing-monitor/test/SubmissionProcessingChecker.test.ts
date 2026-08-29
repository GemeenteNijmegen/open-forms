import { MatchableExecution } from '../executions/ExecutionMatcher';
import { ObjectRecord } from '../model/ObjectRecord';
import { checkProcessing } from '../processing/SubmissionProcessingChecker';

function objectRecord(overrides: Partial<ObjectRecord> & { objectUuid: string; objectIndex: number }): ObjectRecord {
  return {
    objectType: 'https://example.com/objecttypes/api/v2/objecttypes/submission',
    processingKind: 'REGULAR',
    registrationAt: '2026-08-27',
    expectedProcessing: true,
    dataValid: true,
    ...overrides,
  };
}

function execution(objectUuid: string, status: string, executionArn = `arn:exec:${objectUuid}`): MatchableExecution {
  return { executionArn, name: executionArn, status, startDate: new Date('2026-08-27T10:00:00Z'), objectUuid };
}

describe('checkProcessing', () => {
  test('reports SUCCEEDED for a record with exactly one matching execution', () => {
    const record = objectRecord({ objectUuid: 'uuid-1', objectIndex: 1 });
    const results = checkProcessing([record], [execution('uuid-1', 'SUCCEEDED')]);

    expect(results).toEqual([expect.objectContaining({ objectUuid: 'uuid-1', objectIndex: 1, status: 'SUCCEEDED', matchType: 'UNIQUE' })]);
  });

  test.each(['FAILED', 'TIMED_OUT', 'ABORTED', 'RUNNING'])('passes through the execution status %s unchanged', (status) => {
    const record = objectRecord({ objectUuid: 'uuid-1', objectIndex: 1 });
    const results = checkProcessing([record], [execution('uuid-1', status)]);

    expect(results[0].status).toBe(status);
  });

  test('reports MISSING when an expected record has no matching execution', () => {
    const record = objectRecord({ objectUuid: 'uuid-2', objectIndex: 1 });
    const results = checkProcessing([record], []);

    expect(results).toEqual([expect.objectContaining({ objectUuid: 'uuid-2', status: 'MISSING', matchType: 'MISSING' })]);
  });

  test('reports AMBIGUOUS for every index when one object has multiple indexes expecting processing', () => {
    const records = [
      objectRecord({ objectUuid: 'uuid-3', objectIndex: 1 }),
      objectRecord({ objectUuid: 'uuid-3', objectIndex: 2 }),
    ];
    const results = checkProcessing(records, [execution('uuid-3', 'SUCCEEDED')]);

    expect(results).toHaveLength(2);
    expect(results.every(r => r.status === 'AMBIGUOUS' && r.matchType === 'AMBIGUOUS')).toBe(true);
  });

  test('reports AMBIGUOUS when one expected index has more than one execution, without guessing which one applies', () => {
    const record = objectRecord({ objectUuid: 'uuid-4', objectIndex: 1 });
    const results = checkProcessing([record], [execution('uuid-4', 'SUCCEEDED', 'arn:exec:a'), execution('uuid-4', 'FAILED', 'arn:exec:b')]);

    expect(results).toEqual([expect.objectContaining({ status: 'AMBIGUOUS', matchType: 'AMBIGUOUS' })]);
  });

  test('reports INVALID_OBJECT_DATA for a record whose data could not be classified, without attempting a match', () => {
    const record = objectRecord({ objectUuid: 'uuid-5', objectIndex: 1, expectedProcessing: false, dataValid: false });
    const results = checkProcessing([record], [execution('uuid-5', 'SUCCEEDED')]);

    expect(results).toEqual([expect.objectContaining({ objectUuid: 'uuid-5', status: 'INVALID_OBJECT_DATA' })]);
  });

  test('carries processingKind ESF through for a malformed ESF taak, instead of treating it as regular', () => {
    const record = objectRecord({
      objectUuid: 'uuid-esf-malformed', objectIndex: 1, processingKind: 'ESF', expectedProcessing: false, dataValid: false,
    });
    const results = checkProcessing([record], []);

    expect(results).toEqual([expect.objectContaining({ status: 'INVALID_OBJECT_DATA', processingKind: 'ESF' })]);
  });

  test('does not produce a result for a valid record that does not expect processing', () => {
    const record = objectRecord({ objectUuid: 'uuid-6', objectIndex: 1, expectedProcessing: false, esfStatus: 'open' });
    const results = checkProcessing([record], []);

    expect(results).toHaveLength(0);
  });

  test('never guesses on an execution status it does not recognize', () => {
    const record = objectRecord({ objectUuid: 'uuid-7', objectIndex: 1 });
    const results = checkProcessing([record], [execution('uuid-7', 'PENDING_REDRIVE')]);

    expect(results[0].status).toBe('AMBIGUOUS');
  });
});
