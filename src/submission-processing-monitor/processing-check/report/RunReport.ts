export type RunStatus = 'RUNNING' | 'COMPLETE' | 'INCOMPLETE';

export type DayStatus = 'COMPLETE' | 'INCOMPLETE';

export type IncompleteReason = 'OBJECTS_API_FAILED' | 'LOGS_NOT_READ' | 'OUT_OF_TIME';

export interface DayCheck {
  day: string;
  status: DayStatus;
  // Always set for INCOMPLETE, never for COMPLETE.
  reason?: IncompleteReason;
}

// An outcome is only present when at least one version had it.
export interface ObjectTypeTotals {
  objects: number;
  versions: number;
  PROCESSED?: number;
  PROCESSED_AFTER_REDRIVE?: number;
  IGNORED?: number;
  PROBLEM?: number;
  IN_PROGRESS?: number;
  UNCERTAIN?: number;
  // Only for esfTaak: number of versions per esfStatus.
  esfStatus?: Record<string, number>;
}

// Only filled when the log reader runs with diagnostics.
export interface RunCost {
  queries: number;
  bytesScanned: number;
  gbScanned: number;
  estimatedCostUsd: number;
  recordsScanned: number;
  logReadMs: number;
  objectReadMs: number;
  durationMs: number;
}

export interface RunReport {
  runId: string;
  firstDay: string;
  lastDay: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  days: DayCheck[];
  // Keyed by objectTypeName, over the whole period.
  totals: Record<string, ObjectTypeTotals>;
  // Objects with a version in the period whose outcome is not PROCESSED or IGNORED.
  notOkObjectUuids: string[];
  cost?: RunCost;
}

// The answer of the Lambda: the report without the list of objects.
export type RunReportCounts = Omit<RunReport, 'notOkObjectUuids'>;
