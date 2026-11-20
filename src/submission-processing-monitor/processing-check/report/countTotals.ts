import { ObjectTypeTotals } from './RunReport';
import { VersionOutcome } from '../../matcher/SubmissionProcessingMatcher';

// All outcomes of the period, over all days. An object with three versions counts as one object and three versions.
export function countTotals(versionOutcomes: VersionOutcome[]): Record<string, ObjectTypeTotals> {
  const totals: Record<string, ObjectTypeTotals> = {};
  const countedObjectUuids = new Set<string>();

  for (const versionOutcome of versionOutcomes) {
    const version = versionOutcome.version;
    totals[version.objectTypeName] ??= { objects: 0, versions: 0 };
    const typeTotals = totals[version.objectTypeName];

    if (!countedObjectUuids.has(version.objectUuid)) {
      countedObjectUuids.add(version.objectUuid);
      typeTotals.objects++;
    }
    typeTotals.versions++;

    typeTotals[versionOutcome.outcome] = (typeTotals[versionOutcome.outcome] ?? 0) + 1;

    if (version.esfStatus) {
      typeTotals.esfStatus ??= {};
      typeTotals.esfStatus[version.esfStatus] = (typeTotals.esfStatus[version.esfStatus] ?? 0) + 1;
    }
  }
  return totals;
}
