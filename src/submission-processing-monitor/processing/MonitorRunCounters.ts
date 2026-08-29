import { EsfProcessingCounters, RegularProcessingCounters } from '../model/MonitorRun';
import { ObjectRecord } from '../model/ObjectRecord';
import { ProcessingResult } from '../model/ProcessingResult';

export interface MonitorRunCounters {
  regularCounters: RegularProcessingCounters;
  esfCounters: EsfProcessingCounters;
  problemCount: number;
}

/** Split is by processingKind, not esfStatus - a malformed ESF taak has no esfStatus but still counts as ESF (invalid), never regular. */
export function buildMonitorRunCounters(records: ObjectRecord[], results: ProcessingResult[]): MonitorRunCounters {
  const regularResults = results.filter(r => r.processingKind === 'REGULAR');
  const regularSucceeded = regularResults.filter(r => r.status === 'SUCCEEDED').length;
  const regularCounters: RegularProcessingCounters = {
    total: regularResults.length,
    succeeded: regularSucceeded,
    problem: regularResults.length - regularSucceeded,
  };

  const esfRecords = records.filter(r => r.processingKind === 'ESF');
  const afgerondResults = results.filter(r => r.esfStatus === 'afgerond');
  const afgerondSucceeded = afgerondResults.filter(r => r.status === 'SUCCEEDED').length;
  const esfCounters: EsfProcessingCounters = {
    open: esfRecords.filter(r => r.esfStatus === 'open').length,
    verwerkt: esfRecords.filter(r => r.esfStatus === 'verwerkt').length,
    gesloten: esfRecords.filter(r => r.esfStatus === 'gesloten').length,
    afgerond: esfRecords.filter(r => r.esfStatus === 'afgerond').length,
    afgerondSucceeded,
    afgerondProblem: afgerondResults.length - afgerondSucceeded,
    invalid: esfRecords.filter(r => !r.dataValid).length,
  };

  return {
    regularCounters,
    esfCounters,
    problemCount: results.filter(r => r.status !== 'SUCCEEDED').length,
  };
}
