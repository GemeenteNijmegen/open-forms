import { CheckedVersion, SubmissionProcessingHistory } from './store/SubmissionProcessingHistory';
import { OUTCOMES_WORST_FIRST, ProcessingOutcome, RESOLVED_OUTCOMES, VersionOutcome } from '../matcher/SubmissionProcessingMatcher';

export interface CheckedDay {
  existingHistory?: SubmissionProcessingHistory;
  // 'YYYY-MM-DD'. Versions of other days in the existing history stay as they are.
  day: string;
  // All outcomes of one objectUuid for versions registered on that day; at least one.
  versionOutcomes: VersionOutcome[];
  checkedAt: string;
  runId: string;
}

/**
 * Gives the history of one submission after one of its days is checked. It starts from what was stored before:
 * - The versions of the checked day are replaced by today's outcomes; versions of other days stay. Checking a day twice gives no duplicates.
 *   When the logs could not be read (LOGS_NOT_READ), a version that an earlier check found stays as it was.
 * - objectOutcome is the worst outcome over all versions, so one failed version makes the whole submission PROBLEM.
 * - reference and formName come from this check, or stay as they were when this check found none.
 * - firstProblemAt is set the first time the submission is PROBLEM and never changes after that. resolvedAt is set when a submission with a
 *   problem is ok later, and removed again when it goes wrong once more.
 *
 * @example
 * const history = historyAfterCheckingDay({ existingHistory, day: '2026-11-18', versionOutcomes, checkedAt, runId });
 */
export function historyAfterCheckingDay(checkedDay: CheckedDay): SubmissionProcessingHistory {
  const existingHistory = checkedDay.existingHistory;
  const firstVersion = checkedDay.versionOutcomes[0].version;

  const versionsOfOtherDays = (existingHistory?.versions ?? []).filter((version) => version.registrationAt !== checkedDay.day);
  const versionsOfDay = checkedDay.versionOutcomes.map((versionOutcome) => {
    const knownVersion = existingHistory?.versions.find((version) => version.index === versionOutcome.version.index);
    // Logs that could not be read say nothing new, so what an earlier check found stays.
    if (versionOutcome.reason === 'LOGS_NOT_READ' && knownVersion) {
      return knownVersion;
    }
    return toCheckedVersion(versionOutcome);
  });
  const versions = [...versionsOfOtherDays, ...versionsOfDay].sort((a, b) => a.index - b.index);

  const reference = checkedDay.versionOutcomes.find((versionOutcome) => versionOutcome.reference)?.reference ?? existingHistory?.reference;
  const formName = checkedDay.versionOutcomes.find((versionOutcome) => versionOutcome.formName)?.formName ?? existingHistory?.formName;

  const objectOutcome = findWorstOutcome(versions);
  const firstProblemAt = existingHistory?.firstProblemAt ?? (objectOutcome === 'PROBLEM' ? checkedDay.checkedAt : undefined);
  const isResolved = firstProblemAt !== undefined && RESOLVED_OUTCOMES.includes(objectOutcome);
  const resolvedAt = isResolved ? existingHistory?.resolvedAt ?? checkedDay.checkedAt : undefined;

  return {
    objectUuid: firstVersion.objectUuid,
    objectType: firstVersion.objectType,
    objectTypeName: firstVersion.objectTypeName,
    reference,
    formName,
    objectOutcome,
    versions,
    firstCheckedAt: existingHistory?.firstCheckedAt ?? checkedDay.checkedAt,
    lastCheckedAt: checkedDay.checkedAt,
    runId: checkedDay.runId,
    firstProblemAt,
    resolvedAt,
  };
}

function toCheckedVersion(versionOutcome: VersionOutcome): CheckedVersion {
  const traces = versionOutcome.traces;
  return {
    index: versionOutcome.version.index,
    registrationAt: versionOutcome.version.registrationAt,
    esfStatus: versionOutcome.version.esfStatus,
    outcome: versionOutcome.outcome,
    reason: versionOutcome.reason,
    correlationIds: [...new Set(traces.map((trace) => trace.correlation_id))],
    executionArns: [...new Set(traces.flatMap((trace) => trace.executions.map((execution) => execution.execution_arn)))],
  };
}

function findWorstOutcome(versions: CheckedVersion[]): ProcessingOutcome {
  const worstOutcome = OUTCOMES_WORST_FIRST.find((outcome) => versions.some((version) => version.outcome === outcome));
  return worstOutcome ?? 'IGNORED';
}
