import { ObjectRow, ObjectRowVersion } from './ProcessingCheck';
import { ProcessingOutcome, VersionOutcome } from '../matcher/SubmissionProcessingMatcher';

export interface ObjectRowUpdate {
  existingRow?: ObjectRow;
  // The checked day, 'YYYY-MM-DD'. Versions of other days in the existing row stay as they are.
  day: string;
  // All outcomes of one objectUuid for versions registered on that day; at least one.
  versionOutcomes: VersionOutcome[];
  checkedAt: string;
  runId: string;
}

const WORST_OUTCOME_FIRST: ProcessingOutcome[] = ['PROBLEM', 'UNCERTAIN', 'IN_PROGRESS', 'PROCESSED_AFTER_REDRIVE', 'PROCESSED', 'IGNORED'];
const OK_OUTCOMES: ProcessingOutcome[] = ['PROCESSED', 'PROCESSED_AFTER_REDRIVE', 'IGNORED'];
const THREE_YEARS_IN_SECONDS = 3 * 365 * 24 * 60 * 60;

export function updateObjectRow(update: ObjectRowUpdate): ObjectRow {
  const existingRow = update.existingRow;
  const firstVersion = update.versionOutcomes[0].version;

  const versions: ObjectRowVersion[] = [];
  for (const version of existingRow?.versions ?? []) {
    if (version.registrationAt !== update.day) {
      versions.push(version);
    }
  }
  for (const versionOutcome of update.versionOutcomes) {
    versions.push(toObjectRowVersion(versionOutcome));
  }
  versions.sort((a, b) => a.index - b.index);

  let reference = existingRow?.reference;
  let formName = existingRow?.formName;
  for (const versionOutcome of update.versionOutcomes) {
    for (const trace of versionOutcome.traces) {
      const traceIsOnlyForThisVersion = trace.objectIndexes.length === 1 && trace.objectIndexes[0] === versionOutcome.version.index;
      if (!traceIsOnlyForThisVersion) {
        continue;
      }
      for (const event of trace.receiverEvents) {
        if (event.reference) {
          reference = event.reference;
        }
        if (event.formName) {
          formName = event.formName;
        }
      }
    }
  }

  const objectOutcome = findWorstOutcome(versions);
  const objectIsOk = OK_OUTCOMES.includes(objectOutcome);

  let firstProblemAt = existingRow?.firstProblemAt;
  if (!firstProblemAt && objectOutcome === 'PROBLEM') {
    firstProblemAt = update.checkedAt;
  }

  let resolvedAt: string | undefined = undefined;
  if (firstProblemAt && objectIsOk) {
    resolvedAt = existingRow?.resolvedAt ?? update.checkedAt;
  }

  const row: ObjectRow = {
    objectUuid: firstVersion.objectUuid,
    objectType: firstVersion.objectType,
    objectTypeName: firstVersion.objectTypeName,
    objectOutcome,
    versions,
    firstCheckedAt: existingRow?.firstCheckedAt ?? update.checkedAt,
    lastCheckedAt: update.checkedAt,
    runId: update.runId,
    ttl: Math.floor(Date.parse(update.checkedAt) / 1000) + THREE_YEARS_IN_SECONDS,
  };
  if (reference) {
    row.reference = reference;
  }
  if (formName) {
    row.formName = formName;
  }
  if (firstProblemAt) {
    row.firstProblemAt = firstProblemAt;
  }
  if (resolvedAt) {
    row.resolvedAt = resolvedAt;
  }
  return row;
}

function toObjectRowVersion(versionOutcome: VersionOutcome): ObjectRowVersion {
  const correlationIds: string[] = [];
  const executionArns: string[] = [];
  for (const trace of versionOutcome.traces) {
    if (!correlationIds.includes(trace.correlation_id)) {
      correlationIds.push(trace.correlation_id);
    }
    for (const execution of trace.executions) {
      if (!executionArns.includes(execution.execution_arn)) {
        executionArns.push(execution.execution_arn);
      }
    }
  }

  const rowVersion: ObjectRowVersion = {
    index: versionOutcome.version.index,
    registrationAt: versionOutcome.version.registrationAt,
    outcome: versionOutcome.outcome,
    correlationIds,
    executionArns,
  };
  if (versionOutcome.version.esfStatus) {
    rowVersion.esfStatus = versionOutcome.version.esfStatus;
  }
  if (versionOutcome.reason) {
    rowVersion.reason = versionOutcome.reason;
  }
  return rowVersion;
}

function findWorstOutcome(versions: ObjectRowVersion[]): ProcessingOutcome {
  for (const outcome of WORST_OUTCOME_FIRST) {
    for (const version of versions) {
      if (version.outcome === outcome) {
        return outcome;
      }
    }
  }
  return 'IGNORED';
}
