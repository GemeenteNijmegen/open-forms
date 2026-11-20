import { ProcessingOutcome, VersionOutcome } from '../../matcher/SubmissionProcessingMatcher';

// Everything except PROCESSED and IGNORED. Unlike RESOLVED_OUTCOMES a redrive is reported: someone had to step in.
export const OUTCOMES_TO_REPORT: ProcessingOutcome[] = ['PROBLEM', 'UNCERTAIN', 'IN_PROGRESS', 'PROCESSED_AFTER_REDRIVE'];

// Each objectUuid once, in the order of the outcomes.
export function findNotOkObjectUuids(versionOutcomes: VersionOutcome[]): string[] {
  const notOkOutcomes = versionOutcomes.filter((versionOutcome) => OUTCOMES_TO_REPORT.includes(versionOutcome.outcome));
  return [...new Set(notOkOutcomes.map((versionOutcome) => versionOutcome.version.objectUuid))];
}
