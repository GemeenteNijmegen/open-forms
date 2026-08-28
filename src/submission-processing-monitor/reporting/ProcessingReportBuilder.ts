import { ScanCompleteness } from '../dynamodb/persistProcessingResults';
import { MonitorRun } from '../model/MonitorRun';
import { EsfProcessingReport, ProcessingReport } from '../model/ProcessingReport';
import { ProcessingResult } from '../model/ProcessingResult';

function reportBase(monitorRun: MonitorRun, completeness: ScanCompleteness) {
  return {
    status: monitorRun.status,
    periodFrom: monitorRun.periodFrom,
    periodTo: monitorRun.periodTo,
    objectsScanComplete: completeness.objectsScanComplete,
    executionsScanComplete: completeness.executionsScanComplete,
    failureReason: monitorRun.failureReason,
  };
}

/**
 * Builds the regular morning report from a MonitorRun and (only for a COMPLETED run) its
 * results. An INCOMPLETE/FAILED run never gets counters or a problem list, even if some results
 * happen to be available in memory, a half scan never produces reliable functional totals.
 */
export function buildProcessingReport(monitorRun: MonitorRun, completeness: ScanCompleteness, results?: ProcessingResult[]): ProcessingReport {
  const base = reportBase(monitorRun, completeness);

  if (monitorRun.status !== 'COMPLETED' || !results) {
    return { ...base, problems: [] };
  }

  return {
    ...base,
    regularCounters: monitorRun.regularCounters,
    problems: results
      .filter(result => !result.esfStatus && result.status !== 'SUCCEEDED')
      .map(result => ({
        objectUuid: result.objectUuid,
        objectIndex: result.objectIndex,
        reference: result.reference,
        clientNumber: result.clientNumber,
        status: result.status,
      })),
  };
}

/** Builds the ESF-specific morning report, sent separately from buildProcessingReport's regular report. */
export function buildEsfProcessingReport(monitorRun: MonitorRun, completeness: ScanCompleteness, results?: ProcessingResult[]): EsfProcessingReport {
  const base = reportBase(monitorRun, completeness);

  if (monitorRun.status !== 'COMPLETED' || !results) {
    return { ...base, problems: [] };
  }

  return {
    ...base,
    esfCounters: monitorRun.esfCounters,
    problems: results
      .filter(result => result.esfStatus === 'afgerond' && result.status !== 'SUCCEEDED')
      .map(result => ({
        reference: result.reference,
        clientNumber: result.clientNumber,
        status: result.status,
      })),
  };
}
