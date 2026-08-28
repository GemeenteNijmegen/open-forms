export type MonitorRunStatus = 'COMPLETED' | 'INCOMPLETE' | 'FAILED' | 'REPORT_FAILED';

export interface RegularProcessingCounters {
  total: number;
  succeeded: number;
  problem: number;
}

export interface EsfProcessingCounters {
  open: number;
  verwerkt: number;
  gesloten: number;
  afgerond: number;
  afgerondSucceeded: number;
  afgerondProblem: number;
}

/** One compact summary per monitor run. No Object, execution or result staging. */
export interface MonitorRun {
  runId: string;
  periodFrom: string;
  periodTo: string;
  startedAt: string;
  completedAt: string;
  status: MonitorRunStatus;
  /** Only set for FAILED/REPORT_FAILED, or an INCOMPLETE run that stopped early. */
  failureReason?: string;
  objectsScanned: number;
  objectRecordsFound: number;
  executionsScanned: number;
  regularCounters: RegularProcessingCounters;
  esfCounters: EsfProcessingCounters;
  problemCount: number;
}
