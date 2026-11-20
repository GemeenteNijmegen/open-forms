import { VersionOutcome } from '../../matcher/SubmissionProcessingMatcher';

// Each objectUuid once, in the order of the outcomes. Unlike OK_OUTCOMES a redrive is not ok here: someone had to step in, so it is reported.
export function findNotOkObjectUuids(versionOutcomes: VersionOutcome[]): string[] {
  const notOkOutcomes = versionOutcomes.filter((versionOutcome) => versionOutcome.outcome !== 'PROCESSED' && versionOutcome.outcome !== 'IGNORED');
  return [...new Set(notOkOutcomes.map((versionOutcome) => versionOutcome.version.objectUuid))];
}
