import { EsfStatus } from './ObjectRecord';
import { MatchType, ProcessingStatus } from './ProcessingResult';

export type RecoveryStatus = 'OPEN' | 'RESOLVED';

/**
 * Durable record for one Object-record that needs attention, keyed on objectUuid + objectIndex
 * (see ProcessingIssuesTable). Not every field is set for every issue - only what's available and
 * functionally relevant for that record.
 */
export interface ProcessingIssue {
  objectUuid: string;
  objectIndex: number;
  reference?: string;
  clientNumber?: string;
  objectType: string;
  registrationAt: string;
  esfStatus?: EsfStatus;
  processingStatus: ProcessingStatus;
  recoveryStatus: RecoveryStatus;
  matchType?: MatchType;
  firstDetectedAt: string;
  lastCheckedAt: string;
  lastRunId: string;
  executionArn?: string;
  successfulExecutionArn?: string;
  failureCode?: string;
  failureSummary?: string;
  resolvedAt?: string;
}
