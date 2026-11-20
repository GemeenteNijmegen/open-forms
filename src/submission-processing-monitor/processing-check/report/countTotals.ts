import { ObjectTypeTotals } from './RunReport';
import { VersionOutcome } from '../../matcher/SubmissionProcessingMatcher';

// All outcomes of the period, over all days. An object with three versions counts as one object and three versions.
export function countTotals(versionOutcomes: VersionOutcome[]): Record<string, ObjectTypeTotals> {
  const totals: Record<string, ObjectTypeTotals> = {};
  const countedObjectUuids = new Set<string>();

  for (const versionOutcome of versionOutcomes) {
    const version = versionOutcome.version;
    let typeTotals = totals[version.objectTypeName];
    if (!typeTotals) {
      typeTotals = { objects: 0, versions: 0 };
      totals[version.objectTypeName] = typeTotals;
    }

    if (!countedObjectUuids.has(version.objectUuid)) {
      countedObjectUuids.add(version.objectUuid);
      typeTotals.objects++;
    }
    typeTotals.versions++;

    switch (versionOutcome.outcome) {
      case 'PROCESSED':
        typeTotals.PROCESSED = (typeTotals.PROCESSED ?? 0) + 1;
        break;
      case 'PROCESSED_AFTER_REDRIVE':
        typeTotals.PROCESSED_AFTER_REDRIVE = (typeTotals.PROCESSED_AFTER_REDRIVE ?? 0) + 1;
        break;
      case 'IGNORED':
        typeTotals.IGNORED = (typeTotals.IGNORED ?? 0) + 1;
        break;
      case 'PROBLEM':
        typeTotals.PROBLEM = (typeTotals.PROBLEM ?? 0) + 1;
        break;
      case 'IN_PROGRESS':
        typeTotals.IN_PROGRESS = (typeTotals.IN_PROGRESS ?? 0) + 1;
        break;
      case 'UNCERTAIN':
        typeTotals.UNCERTAIN = (typeTotals.UNCERTAIN ?? 0) + 1;
        break;
    }

    if (version.esfStatus) {
      if (!typeTotals.esfStatus) {
        typeTotals.esfStatus = {};
      }
      typeTotals.esfStatus[version.esfStatus] = (typeTotals.esfStatus[version.esfStatus] ?? 0) + 1;
    }
  }
  return totals;
}
