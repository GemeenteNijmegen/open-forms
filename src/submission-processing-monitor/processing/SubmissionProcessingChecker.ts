import { ExecutionMatch, MatchableExecution, matchExecutions } from '../executions/ExecutionMatcher';
import { ObjectRecord } from '../model/ObjectRecord';
import { ProcessingResult, ProcessingStatus } from '../model/ProcessingResult';

/**
 * Turns object records and executions into a functional outcome per record, without any AWS
 * side-effects. Only records with invalid data or that expect processing get a result; a valid,
 * not-yet-expected record (e.g. an ESF taak that's still open) doesn't need one.
 */
export function checkProcessing(records: ObjectRecord[], executions: MatchableExecution[]): ProcessingResult[] {
  const results: ProcessingResult[] = [];
  const expectedRecords: ObjectRecord[] = [];

  for (const record of records) {
    if (!record.dataValid) {
      results.push(toResult(record, 'INVALID_OBJECT_DATA'));
      continue;
    }
    if (record.expectedProcessing) {
      expectedRecords.push(record);
    }
  }

  const expectedIndexesByObjectUuid = new Map<string, number[]>();
  for (const record of expectedRecords) {
    const indexes = expectedIndexesByObjectUuid.get(record.objectUuid) ?? [];
    indexes.push(record.objectIndex);
    expectedIndexesByObjectUuid.set(record.objectUuid, indexes);
  }

  const matches = matchExecutions(expectedIndexesByObjectUuid, executions);
  const recordsByKey = new Map(expectedRecords.map(record => [matchKey(record.objectUuid, record.objectIndex), record]));

  for (const match of matches) {
    const record = recordsByKey.get(matchKey(match.objectUuid, match.objectIndex));
    if (!record) {
      continue;
    }
    if (match.matchType === 'MISSING' || match.matchType === 'AMBIGUOUS') {
      results.push(toResult(record, match.matchType, match));
    } else {
      results.push(toResult(record, mapExecutionStatus(match.execution!.status), match));
    }
  }

  return results;
}

function matchKey(objectUuid: string, objectIndex: number): string {
  return `${objectUuid}#${objectIndex}`;
}

function toResult(record: ObjectRecord, status: ProcessingStatus, match?: ExecutionMatch): ProcessingResult {
  return {
    objectUuid: record.objectUuid,
    objectIndex: record.objectIndex,
    objectType: record.objectType,
    registrationAt: record.registrationAt,
    reference: record.reference,
    clientNumber: record.clientNumber,
    esfStatus: record.esfStatus,
    status,
    matchType: match?.matchType,
    executionArn: match?.execution?.executionArn,
  };
}

/** Never guesses: an execution status this monitor doesn't know about becomes AMBIGUOUS, not a silent pass-through. */
function mapExecutionStatus(status: string): ProcessingStatus {
  switch (status) {
    case 'SUCCEEDED':
    case 'FAILED':
    case 'TIMED_OUT':
    case 'ABORTED':
    case 'RUNNING':
      return status;
    default:
      return 'AMBIGUOUS';
  }
}
