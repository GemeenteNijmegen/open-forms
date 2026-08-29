import { MonitorRun } from '../model/MonitorRun';
import { ProcessingResult } from '../model/ProcessingResult';
import { buildEsfProcessingReport, buildProcessingReport } from '../reporting/ProcessingReportBuilder';

function completedRun(overrides: Partial<MonitorRun> = {}): MonitorRun {
  return {
    runId: 'run-1',
    periodFrom: '2026-08-27',
    periodTo: '2026-08-28',
    startedAt: '2026-08-28T04:00:00.000Z',
    completedAt: '2026-08-28T04:05:00.000Z',
    status: 'COMPLETED',
    objectsScanned: 5,
    objectRecordsFound: 5,
    executionsScanned: 5,
    regularCounters: { total: 3, succeeded: 2, problem: 1 },
    esfCounters: { open: 1, verwerkt: 1, gesloten: 1, afgerond: 1, afgerondSucceeded: 1, afgerondProblem: 0, invalid: 0 },
    problemCount: 1,
    ...overrides,
  };
}

describe('buildProcessingReport', () => {
  test('a COMPLETED run includes counters and a problem per non-succeeded regular result', () => {
    const results: ProcessingResult[] = [
      { objectUuid: 'uuid-1', objectIndex: 1, objectType: 'submission', processingKind: 'REGULAR', registrationAt: '2026-08-27', status: 'SUCCEEDED', reference: 'OF-1' },
      { objectUuid: 'uuid-2', objectIndex: 1, objectType: 'submission', processingKind: 'REGULAR', registrationAt: '2026-08-27', status: 'FAILED', reference: 'OF-2', clientNumber: '12345' },
    ];

    const report = buildProcessingReport(completedRun(), { objectsScanComplete: true, executionsScanComplete: true }, results);

    expect(report.status).toBe('COMPLETED');
    expect(report.regularCounters).toEqual({ total: 3, succeeded: 2, problem: 1 });
    expect(report.problems).toEqual([
      { objectUuid: 'uuid-2', objectIndex: 1, reference: 'OF-2', clientNumber: '12345', status: 'FAILED' },
    ]);
  });

  test('excludes ESF problems - those belong to the separate ESF report', () => {
    const results: ProcessingResult[] = [
      { objectUuid: 'uuid-1', objectIndex: 1, objectType: 'esftaak', processingKind: 'ESF', registrationAt: '2026-08-27', status: 'FAILED', esfStatus: 'afgerond', reference: 'ESF-1' },
    ];

    const report = buildProcessingReport(completedRun(), { objectsScanComplete: true, executionsScanComplete: true }, results);

    expect(report.problems).toEqual([]);
  });

  test('a malformed ESF result (processingKind ESF, esfStatus undefined) never ends up in the regular report', () => {
    const results: ProcessingResult[] = [
      { objectUuid: 'uuid-esf', objectIndex: 1, objectType: 'esftaak', processingKind: 'ESF', registrationAt: '2026-08-27', status: 'INVALID_OBJECT_DATA' },
      { objectUuid: 'uuid-reg', objectIndex: 1, objectType: 'submission', processingKind: 'REGULAR', registrationAt: '2026-08-27', status: 'FAILED', reference: 'OF-1' },
    ];

    const report = buildProcessingReport(completedRun(), { objectsScanComplete: true, executionsScanComplete: true }, results);

    expect(report.problems).toEqual([
      { objectUuid: 'uuid-reg', objectIndex: 1, reference: 'OF-1', clientNumber: undefined, status: 'FAILED' },
    ]);
  });

  test('an INCOMPLETE run carries no counters or problems, even when results are passed in', () => {
    const run = completedRun({ status: 'INCOMPLETE', failureReason: 'TIME_LIMIT_REACHED' });
    const results: ProcessingResult[] = [
      { objectUuid: 'uuid-1', objectIndex: 1, objectType: 'submission', processingKind: 'REGULAR', registrationAt: '2026-08-27', status: 'FAILED' },
    ];

    const report = buildProcessingReport(run, { objectsScanComplete: true, executionsScanComplete: false }, results);

    expect(report.status).toBe('INCOMPLETE');
    expect(report.failureReason).toBe('TIME_LIMIT_REACHED');
    expect(report.objectsScanComplete).toBe(true);
    expect(report.executionsScanComplete).toBe(false);
    expect(report.regularCounters).toBeUndefined();
    expect(report.problems).toEqual([]);
  });

  test('a COMPLETED run with zero problems still reports its counters', () => {
    const results: ProcessingResult[] = [
      { objectUuid: 'uuid-1', objectIndex: 1, objectType: 'submission', processingKind: 'REGULAR', registrationAt: '2026-08-27', status: 'SUCCEEDED' },
    ];

    const report = buildProcessingReport(completedRun(), { objectsScanComplete: true, executionsScanComplete: true }, results);

    expect(report.problems).toEqual([]);
    expect(report.regularCounters).toBeDefined();
  });
});

describe('buildEsfProcessingReport', () => {
  test('a COMPLETED run includes ESF counters and a problem per non-succeeded afgerond ESF result, with only reference/clientNumber/status', () => {
    const results: ProcessingResult[] = [
      {
        objectUuid: 'uuid-1',
        objectIndex: 1,
        objectType: 'esftaak',
        processingKind: 'ESF',
        registrationAt: '2026-08-27',
        status: 'FAILED',
        esfStatus: 'afgerond',
        reference: 'ESF-1',
        clientNumber: '12345',
      },
    ];

    const report = buildEsfProcessingReport(completedRun(), { objectsScanComplete: true, executionsScanComplete: true }, results);

    expect(report.status).toBe('COMPLETED');
    expect(report.esfCounters).toEqual({ open: 1, verwerkt: 1, gesloten: 1, afgerond: 1, afgerondSucceeded: 1, afgerondProblem: 0, invalid: 0 });
    expect(report.problems).toEqual([{ reference: 'ESF-1', clientNumber: '12345', status: 'FAILED' }]);
  });

  test('includes a malformed ESF result (INVALID_OBJECT_DATA, esfStatus undefined) - it must not silently disappear from both reports', () => {
    const results: ProcessingResult[] = [
      {
        objectUuid: 'uuid-esf', objectIndex: 1, objectType: 'esftaak', processingKind: 'ESF', registrationAt: '2026-08-27', status: 'INVALID_OBJECT_DATA', clientNumber: '999',
      },
      { objectUuid: 'uuid-reg', objectIndex: 1, objectType: 'submission', processingKind: 'REGULAR', registrationAt: '2026-08-27', status: 'FAILED', reference: 'OF-1' },
    ];

    const report = buildEsfProcessingReport(completedRun(), { objectsScanComplete: true, executionsScanComplete: true }, results);

    expect(report.problems).toEqual([{ reference: undefined, clientNumber: '999', status: 'INVALID_OBJECT_DATA' }]);
  });

  test('excludes regular problems - those belong to the separate regular report', () => {
    const results: ProcessingResult[] = [
      { objectUuid: 'uuid-1', objectIndex: 1, objectType: 'submission', processingKind: 'REGULAR', registrationAt: '2026-08-27', status: 'FAILED', reference: 'OF-1' },
    ];

    const report = buildEsfProcessingReport(completedRun(), { objectsScanComplete: true, executionsScanComplete: true }, results);

    expect(report.problems).toEqual([]);
  });

  test('an INCOMPLETE run carries no ESF counters or problems, even when results are passed in', () => {
    const run = completedRun({ status: 'FAILED', failureReason: 'Objects API is unreachable' });
    const results: ProcessingResult[] = [
      { objectUuid: 'uuid-1', objectIndex: 1, objectType: 'esftaak', processingKind: 'ESF', registrationAt: '2026-08-27', status: 'FAILED', esfStatus: 'afgerond' },
    ];

    const report = buildEsfProcessingReport(run, { objectsScanComplete: false, executionsScanComplete: false }, results);

    expect(report.status).toBe('FAILED');
    expect(report.failureReason).toBe('Objects API is unreachable');
    expect(report.esfCounters).toBeUndefined();
    expect(report.problems).toEqual([]);
  });
});
