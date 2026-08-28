import { persistProcessingResults, ScanCompleteness } from '../dynamodb/persistProcessingResults';
import { ProcessingIssueRepository } from '../dynamodb/ProcessingIssueRepository';
import { ProcessingResult } from '../model/ProcessingResult';

function result(overrides: Partial<ProcessingResult> & { objectUuid: string; objectIndex: number; status: ProcessingResult['status'] }): ProcessingResult {
  return {
    objectType: 'https://example.com/objecttypes/api/v2/objecttypes/d3713c2b-307c-4c07-8eaa-c2c6d75869cf',
    registrationAt: '2026-08-27',
    ...overrides,
  };
}

function fakeRepository(): jest.Mocked<Pick<ProcessingIssueRepository, 'recordProblem' | 'recordResolved'>> {
  return {
    recordProblem: jest.fn().mockResolvedValue(undefined),
    recordResolved: jest.fn().mockResolvedValue(undefined),
  };
}

describe('persistProcessingResults', () => {
  const context = { runId: 'run-1', checkedAt: new Date('2026-08-28T04:00:00Z') };
  const complete: ScanCompleteness = { objectsScanComplete: true, executionsScanComplete: true };

  test('records problems and resolves succeeded records once both scans are complete', async () => {
    const repository = fakeRepository();
    const results = [
      result({ objectUuid: 'uuid-1', objectIndex: 1, status: 'FAILED' }),
      result({ objectUuid: 'uuid-2', objectIndex: 1, status: 'SUCCEEDED' }),
    ];

    await persistProcessingResults(repository as unknown as ProcessingIssueRepository, results, complete, context);

    expect(repository.recordProblem).toHaveBeenCalledTimes(1);
    expect(repository.recordProblem).toHaveBeenCalledWith(results[0], context);
    expect(repository.recordResolved).toHaveBeenCalledTimes(1);
    expect(repository.recordResolved).toHaveBeenCalledWith(results[1], context);
  });

  test.each<[ScanCompleteness]>([
    [{ objectsScanComplete: false, executionsScanComplete: true }],
    [{ objectsScanComplete: true, executionsScanComplete: false }],
  ])('makes no ProcessingIssue updates - and therefore refreshes no TTL - when a scan is incomplete: %j', async (completeness) => {
    const repository = fakeRepository();
    const results = [result({ objectUuid: 'uuid-1', objectIndex: 1, status: 'FAILED' })];

    await persistProcessingResults(repository as unknown as ProcessingIssueRepository, results, completeness, context);

    expect(repository.recordProblem).not.toHaveBeenCalled();
    expect(repository.recordResolved).not.toHaveBeenCalled();
  });
});
