import { ProcessingOutcome, ProcessingReason } from '../../matcher/SubmissionProcessingMatcher';

export interface CheckedVersion {
  index: number;
  registrationAt: string;
  esfStatus?: string;
  outcome: ProcessingOutcome;
  reason?: ProcessingReason;
  correlationIds: string[];
  executionArns: string[];
}

// What the table holds per objectUuid: every version ever checked, over all days.
export interface SubmissionProcessingHistory {
  objectUuid: string;
  objectType: string;
  objectTypeName: string;
  // Only from traces that belong to exactly one version of this object.
  reference?: string;
  formName?: string;
  // The worst outcome of the versions, in the order of OUTCOMES_WORST_FIRST.
  objectOutcome: ProcessingOutcome;
  versions: CheckedVersion[];
  firstCheckedAt: string;
  lastCheckedAt: string;
  runId: string;
  firstProblemAt?: string;
  resolvedAt?: string;
}
