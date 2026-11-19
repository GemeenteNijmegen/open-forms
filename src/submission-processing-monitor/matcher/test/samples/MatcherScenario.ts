import { ProcessingOutcome, ProcessingReason, SubmissionProcessingMatcherInput } from '../../SubmissionProcessingMatcher';

// One sample file is one scenario: what the readers return, and what findOutcomes must give for it.
export interface MatcherScenario {
  description: string;
  input: SubmissionProcessingMatcherInput;
  // Compared with toMatchObject: only these fields are checked, in the order findOutcomes returns them (objectUuid, then index).
  expected: {
    versions: {
      version: { objectUuid: string; index: number };
      outcome: ProcessingOutcome;
      reason?: ProcessingReason;
      traces: { correlation_id: string }[];
    }[];
    tracesWithoutVersion: { correlation_id: string }[];
  };
}
