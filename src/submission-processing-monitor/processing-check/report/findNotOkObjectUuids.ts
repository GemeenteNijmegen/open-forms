import { VersionOutcome } from '../../matcher/SubmissionProcessingMatcher';

// Each objectUuid once, in the order of the outcomes.
export function findNotOkObjectUuids(versionOutcomes: VersionOutcome[]): string[] {
  const notOkObjectUuids: string[] = [];
  for (const versionOutcome of versionOutcomes) {
    const isOk = versionOutcome.outcome === 'PROCESSED' || versionOutcome.outcome === 'IGNORED';
    const objectUuid = versionOutcome.version.objectUuid;
    if (!isOk && !notOkObjectUuids.includes(objectUuid)) {
      notOkObjectUuids.push(objectUuid);
    }
  }
  return notOkObjectUuids;
}
