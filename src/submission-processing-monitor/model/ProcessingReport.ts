import { MonitorRunStatus, RegularProcessingCounters, EsfProcessingCounters } from './MonitorRun';
import { ProcessingStatus } from './ProcessingResult';

export interface ProcessingReportProblem {
  objectUuid: string;
  objectIndex: number;
  reference?: string;
  clientNumber?: string;
  status: ProcessingStatus;
}

/**
 * The regular morning report for one MonitorRun. Only COMPLETED runs carry counters/problems - an
 * INCOMPLETE or FAILED run never has reliable functional totals. ESF has its own report, see
 * EsfProcessingReport.
 */
export interface ProcessingReport {
  status: MonitorRunStatus;
  periodFrom: string;
  periodTo: string;
  objectsScanComplete: boolean;
  executionsScanComplete: boolean;
  failureReason?: string;
  regularCounters?: RegularProcessingCounters;
  problems: ProcessingReportProblem[];
}

export interface EsfProcessingReportProblem {
  reference?: string;
  clientNumber?: string;
  status: ProcessingStatus;
}

/** The ESF-specific morning report, sent separately from ProcessingReport. */
export interface EsfProcessingReport {
  status: MonitorRunStatus;
  periodFrom: string;
  periodTo: string;
  objectsScanComplete: boolean;
  executionsScanComplete: boolean;
  failureReason?: string;
  esfCounters?: EsfProcessingCounters;
  problems: EsfProcessingReportProblem[];
}
