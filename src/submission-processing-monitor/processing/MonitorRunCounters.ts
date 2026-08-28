import { EsfProcessingCounters, RegularProcessingCounters } from '../model/MonitorRun';
import { ObjectRecord } from '../model/ObjectRecord';
import { ProcessingResult } from '../model/ProcessingResult';

export interface MonitorRunCounters {
  regularCounters: RegularProcessingCounters;
  esfCounters: EsfProcessingCounters;
  problemCount: number;
}

/**
 * Regular vs ESF is determined by esfStatus presence on the result, same split the checker's own
 * scenario tests already use - an ESF taak with unrecognisable status (esfStatus undefined,
 * INVALID_OBJECT_DATA) ends up counted as regular, matching that established behaviour.
 */
export function buildMonitorRunCounters(records: ObjectRecord[], results: ProcessingResult[]): MonitorRunCounters {
  const regularResults = results.filter(r => !r.esfStatus);
  const regularSucceeded = regularResults.filter(r => r.status === 'SUCCEEDED').length;
  const regularCounters: RegularProcessingCounters = {
    total: regularResults.length,
    succeeded: regularSucceeded,
    problem: regularResults.length - regularSucceeded,
  };

  const esfRecords = records.filter(r => r.esfStatus);
  const afgerondResults = results.filter(r => r.esfStatus === 'afgerond');
  const afgerondSucceeded = afgerondResults.filter(r => r.status === 'SUCCEEDED').length;
  const esfCounters: EsfProcessingCounters = {
    open: esfRecords.filter(r => r.esfStatus === 'open').length,
    verwerkt: esfRecords.filter(r => r.esfStatus === 'verwerkt').length,
    gesloten: esfRecords.filter(r => r.esfStatus === 'gesloten').length,
    afgerond: esfRecords.filter(r => r.esfStatus === 'afgerond').length,
    afgerondSucceeded,
    afgerondProblem: afgerondResults.length - afgerondSucceeded,
  };

  return {
    regularCounters,
    esfCounters,
    problemCount: results.filter(r => r.status !== 'SUCCEEDED').length,
  };
}
