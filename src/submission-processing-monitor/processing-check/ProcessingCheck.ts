import { Logger } from '@aws-lambda-powertools/logger';
import { RunReport } from './report/RunReport';
import { ProcessingOutcome, ProcessingReason } from '../matcher/SubmissionProcessingMatcher';

// The test event from the Lambda console. Both days or neither; neither means yesterday in Amsterdam.
export interface ProcessingCheckEvent {
  firstDay?: string;
  lastDay?: string;
}

export interface ProcessingCheckOptions {
  tableName: string;
  // Passed to the log reader; also fills the cost block of the report.
  diagnostics: boolean;
  logger?: Logger;
}

export interface ProcessingCheckRun {
  event: ProcessingCheckEvent;
  // The Lambda request id.
  runId: string;
  // context.getRemainingTimeInMillis of the Lambda, checked before each new objectUuid.
  getRemainingTimeInMillis: () => number;
}

export interface ObjectRowVersion {
  index: number;
  registrationAt: string;
  esfStatus?: string;
  outcome: ProcessingOutcome;
  reason?: ProcessingReason;
  correlationIds: string[];
  executionArns: string[];
}

// One row per objectUuid (PK OBJECT#<objectUuid>, SK OBJECT), with every version ever checked.
export interface ObjectRow {
  objectUuid: string;
  objectType: string;
  objectTypeName: string;
  // Only from traces that belong to exactly one version of this object.
  reference?: string;
  formName?: string;
  // The worst outcome of the versions: PROBLEM, UNCERTAIN, IN_PROGRESS, PROCESSED_AFTER_REDRIVE, PROCESSED, IGNORED.
  objectOutcome: ProcessingOutcome;
  versions: ObjectRowVersion[];
  firstCheckedAt: string;
  lastCheckedAt: string;
  runId: string;
  firstProblemAt?: string;
  resolvedAt?: string;
  // Epoch seconds, three years after lastCheckedAt.
  ttl: number;
}

/**
 * Checks per Amsterdam day of a period whether the submissions were processed, and stores the outcomes in DynamoDB.
 *
 * Per day: the object reader finds the versions, the log reader reads the logs per objectUuid (from the start of that day until now), and the
 * matcher decides the outcome per version. Each object row is updated, and the run report (PK RUN) records per day COMPLETE or INCOMPLETE.
 * Only looks; it changes nothing in the Objects API and restarts nothing.
 *
 * @example
 * const check = new ProcessingCheck({ tableName: process.env.TABLE_NAME!, diagnostics: true });
 * const report = await check.run({
 *   event: { firstDay: '2026-11-16', lastDay: '2026-11-18' },
 *   runId: context.awsRequestId,
 *   getRemainingTimeInMillis: () => context.getRemainingTimeInMillis(),
 * });
 */
export class ProcessingCheck {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: ProcessingCheckOptions) {}

  /**
   * @param run The event with the period, the runId and the remaining Lambda time.
   * @returns The stored report of the run. Throws before writing anything when the period is invalid, and when storing fails.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async run(run: ProcessingCheckRun): Promise<RunReport> {
    throw new Error('ProcessingCheck.run is not implemented');
  }
}
