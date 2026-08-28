import { ObjectRecord } from '../model/ObjectRecord';
import { ProcessingResult } from '../model/ProcessingResult';
import { buildMonitorRunCounters } from '../processing/MonitorRunCounters';

function record(overrides: Partial<ObjectRecord> & { objectUuid: string }): ObjectRecord {
  return {
    objectIndex: 1,
    objectType: 'submission',
    registrationAt: '2026-08-27',
    expectedProcessing: true,
    dataValid: true,
    ...overrides,
  };
}

function result(overrides: Partial<ProcessingResult> & { objectUuid: string; status: ProcessingResult['status'] }): ProcessingResult {
  return {
    objectIndex: 1,
    objectType: 'submission',
    registrationAt: '2026-08-27',
    ...overrides,
  };
}

describe('buildMonitorRunCounters', () => {
  test('splits regular vs ESF afgerond good/problem, and counts every ESF status from the full record set', () => {
    const records: ObjectRecord[] = [
      record({ objectUuid: 'reg-1' }),
      record({ objectUuid: 'reg-2' }),
      record({ objectUuid: 'esf-open', esfStatus: 'open', expectedProcessing: false }),
      record({ objectUuid: 'esf-verwerkt', esfStatus: 'verwerkt', expectedProcessing: false }),
      record({ objectUuid: 'esf-gesloten', esfStatus: 'gesloten', expectedProcessing: false }),
      record({ objectUuid: 'esf-afgerond-1', esfStatus: 'afgerond' }),
      record({ objectUuid: 'esf-afgerond-2', esfStatus: 'afgerond' }),
    ];
    const results: ProcessingResult[] = [
      result({ objectUuid: 'reg-1', status: 'SUCCEEDED' }),
      result({ objectUuid: 'reg-2', status: 'FAILED' }),
      result({ objectUuid: 'esf-afgerond-1', status: 'SUCCEEDED', esfStatus: 'afgerond' }),
      result({ objectUuid: 'esf-afgerond-2', status: 'MISSING', esfStatus: 'afgerond' }),
    ];

    const counters = buildMonitorRunCounters(records, results);

    expect(counters.regularCounters).toEqual({ total: 2, succeeded: 1, problem: 1 });
    expect(counters.esfCounters).toEqual({ open: 1, verwerkt: 1, gesloten: 1, afgerond: 2, afgerondSucceeded: 1, afgerondProblem: 1 });
    expect(counters.problemCount).toBe(2);
  });

  test('a run with zero problems reports problemCount 0', () => {
    const records: ObjectRecord[] = [record({ objectUuid: 'reg-1' })];
    const results: ProcessingResult[] = [result({ objectUuid: 'reg-1', status: 'SUCCEEDED' })];

    const counters = buildMonitorRunCounters(records, results);

    expect(counters.problemCount).toBe(0);
    expect(counters.regularCounters).toEqual({ total: 1, succeeded: 1, problem: 0 });
  });
});
