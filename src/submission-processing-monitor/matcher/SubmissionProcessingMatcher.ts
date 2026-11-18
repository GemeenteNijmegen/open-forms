import { ObjectVersion } from '../object-reader/ObjectReader';
import { SubmissionLogTrace, SubmissionLogUuidResult } from '../submission-log-reader/SubmissionLogReaderTypes';

export interface SubmissionProcessingMatcherInput {
  versions: ObjectVersion[];
  // One result per objectUuid whose logs were read.
  logs: SubmissionLogUuidResult[];
  // objectUuids for which the log reader threw. Their versions become UNCERTAIN with LOGS_NOT_READ.
  objectUuidsWithUnreadLogs: string[];
}

export type ProcessingOutcome = 'PROCESSED' | 'IGNORED' | 'PROBLEM' | 'IN_PROGRESS' | 'UNCERTAIN';

export type ProcessingReason =
  // PROBLEM
  | 'NO_NOTIFICATION'
  | 'OBJECT_FETCH_FAILED'
  | 'OBJECT_PARSE_FAILED'
  | 'OBJECT_TYPE_UNKNOWN_AT_RECEIVER'
  | 'EXECUTION_START_FAILED'
  | 'EXECUTION_NOT_STARTED'
  | 'EXECUTION_FAILED'
  | 'EXECUTION_TIMED_OUT'
  | 'EXECUTION_ABORTED'
  // UNCERTAIN
  | 'LOGS_NOT_READ'
  | 'LOGS_TIME_RANGE_TOO_SHORT'
  | 'TRACE_FITS_MULTIPLE_VERSIONS'
  | 'UNKNOWN_ESF_STATUS'
  | 'EXECUTION_EVENTS_NOT_FOUND';

export interface VersionOutcome {
  version: ObjectVersion;
  outcome: ProcessingOutcome;
  // Always set for PROBLEM and UNCERTAIN, never for the other outcomes.
  reason?: ProcessingReason;
  // The traces the outcome is based on, with their correlation_id, receiver events and executions.
  traces: SubmissionLogTrace[];
}

export interface SubmissionProcessingOutcomes {
  // One per input version, in a stable order: objectUuid, then index.
  versions: VersionOutcome[];
  // Traces whose index matches none of the input versions, for example a version registered after the period.
  tracesWithoutVersion: SubmissionLogTrace[];
}

/**
 * Decides per Object version what happened to it, from the facts of the object reader and the submission log reader.
 *
 * Pure and synchronous: no AWS or HTTP calls, no clock, no mutations. The same input always gives the same outcomes.
 * Missing logs are never a PROBLEM on their own; when the logs were not read or do not cover enough time, the outcome is UNCERTAIN.
 *
 * @example
 * const matcher = new SubmissionProcessingMatcher();
 * const outcomes = matcher.findOutcomes({
 *   versions: await objectReader.findVersions(),
 *   logs: [await logReader.findByObjectUuid({ objectUuid, range })],
 *   objectUuidsWithUnreadLogs: [],
 * });
 * const problems = outcomes.versions.filter(versionOutcome => versionOutcome.outcome === 'PROBLEM');
 */
export class SubmissionProcessingMatcher {
  /**
   * @param input All versions of the period, the logs per objectUuid, and the objectUuids whose logs could not be read.
   * @returns One outcome per version, plus the traces that belong to no version.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findOutcomes(input: SubmissionProcessingMatcherInput): SubmissionProcessingOutcomes {
    throw new Error('SubmissionProcessingMatcher.findOutcomes is not implemented');
  }
}
