import { SubmissionExecution } from './SubmissionExecutionReader';
import { MatchType } from '../model/ProcessingResult';

export interface MatchableExecution extends SubmissionExecution {
  /** From describeExecution's execution input, absent if the input couldn't be read. */
  objectUuid?: string;
}

export interface ExecutionMatch {
  objectUuid: string;
  objectIndex: number;
  matchType: MatchType;
  execution?: MatchableExecution;
}

/**
 * Matches object UUIDs to executions. The execution input carries no object index, so a UUID
 * with more than one expected record, or more than one execution, can't be split up reliably -
 * both become AMBIGUOUS rather than a guess.
 */
export function matchExecutions(
  expectedIndexesByObjectUuid: Map<string, number[]>,
  executions: MatchableExecution[],
): ExecutionMatch[] {
  const executionsByObjectUuid = new Map<string, MatchableExecution[]>();
  for (const execution of executions) {
    if (!execution.objectUuid) {
      continue;
    }
    const list = executionsByObjectUuid.get(execution.objectUuid) ?? [];
    list.push(execution);
    executionsByObjectUuid.set(execution.objectUuid, list);
  }

  const matches: ExecutionMatch[] = [];
  for (const [objectUuid, objectIndexes] of expectedIndexesByObjectUuid) {
    const executionsForUuid = executionsByObjectUuid.get(objectUuid) ?? [];

    if (objectIndexes.length === 1 && executionsForUuid.length === 1) {
      matches.push({ objectUuid, objectIndex: objectIndexes[0], matchType: 'UNIQUE', execution: executionsForUuid[0] });
      continue;
    }
    if (objectIndexes.length === 1 && executionsForUuid.length === 0) {
      matches.push({ objectUuid, objectIndex: objectIndexes[0], matchType: 'MISSING' });
      continue;
    }
    for (const objectIndex of objectIndexes) {
      matches.push({ objectUuid, objectIndex, matchType: 'AMBIGUOUS' });
    }
  }
  return matches;
}
