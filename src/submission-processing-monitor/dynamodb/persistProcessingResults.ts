import { ProcessingIssueContext, ProcessingIssueRepository } from './ProcessingIssueRepository';
import { ProcessingResult } from '../model/ProcessingResult';

export interface ScanCompleteness {
  objectsScanComplete: boolean;
  executionsScanComplete: boolean;
}

/**
 * Persists ProcessingIssues for one run's results - but only once both scans finished completely.
 * An INCOMPLETE run's results are never made durable: no new/updated issues, no resolves, no TTL
 * refresh on existing issues. The MonitorRun summary itself is saved separately and unconditionally.
 */
export async function persistProcessingResults(
  repository: ProcessingIssueRepository,
  results: ProcessingResult[],
  completeness: ScanCompleteness,
  context: ProcessingIssueContext,
): Promise<void> {
  if (!completeness.objectsScanComplete || !completeness.executionsScanComplete) {
    return;
  }
  for (const result of results) {
    if (result.status === 'SUCCEEDED') {
      await repository.recordResolved(result, context);
    } else {
      await repository.recordProblem(result, context);
    }
  }
}
