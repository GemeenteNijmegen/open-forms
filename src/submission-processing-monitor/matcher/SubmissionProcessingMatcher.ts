import { findVersionOutcome, registrationDayPlusOneHour } from './findVersionOutcome';
import { ObjectVersion } from '../object-reader/ObjectReader';
import { SubmissionLogTrace, SubmissionLogUuidResult } from '../submission-log-reader/SubmissionLogReaderTypes';
import { categorizeTracesByObjectIndex } from '../submission-log-reader/traces/SubmissionTraceBuilder';

export interface SubmissionProcessingMatcherInput {
  versions: ObjectVersion[];
  // One result per objectUuid whose logs were read. findOutcomes throws when an objectUuid appears twice, or also in objectUuidsWithUnreadLogs.
  logs: SubmissionLogUuidResult[];
  // objectUuids for which the log reader threw. Their versions become UNCERTAIN with LOGS_NOT_READ.
  objectUuidsWithUnreadLogs: string[];
}

// PROCESSED_AFTER_REDRIVE: the execution failed, was redriven from the console and then succeeded. Reported apart so someone can check it.
export type ProcessingOutcome = 'PROCESSED' | 'PROCESSED_AFTER_REDRIVE' | 'IGNORED' | 'PROBLEM' | 'IN_PROGRESS' | 'UNCERTAIN';

export const OUTCOMES_WORST_FIRST: ProcessingOutcome[] = ['PROBLEM', 'UNCERTAIN', 'IN_PROGRESS', 'PROCESSED_AFTER_REDRIVE', 'PROCESSED', 'IGNORED'];

// Processed in the end, also when a redrive was needed: a problem with one of these outcomes is resolved.
export const RESOLVED_OUTCOMES: ProcessingOutcome[] = ['PROCESSED', 'PROCESSED_AFTER_REDRIVE', 'IGNORED'];

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
  // From the receiver logs of traces with only this version's index, so they certainly belong to this version.
  reference?: string;
  formName?: string;
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
  findOutcomes(input: SubmissionProcessingMatcherInput): SubmissionProcessingOutcomes {
    const objectUuidsWithLogs = new Set<string>();
    for (const logs of input.logs) {
      if (objectUuidsWithLogs.has(logs.lookup.objectUuid)) {
        throw new Error(`Logs for objectUuid ${logs.lookup.objectUuid} appear more than once`);
      }
      if (input.objectUuidsWithUnreadLogs.includes(logs.lookup.objectUuid)) {
        throw new Error(`objectUuid ${logs.lookup.objectUuid} has logs and is also in objectUuidsWithUnreadLogs`);
      }
      objectUuidsWithLogs.add(logs.lookup.objectUuid);
    }

    const sortedVersions = [...input.versions].sort(compareVersions);

    // Map keeps insertion order, so the objects stay sorted on objectUuid.
    const versionsByObjectUuid = new Map<string, ObjectVersion[]>();
    for (const version of sortedVersions) {
      const versionsOfObject = versionsByObjectUuid.get(version.objectUuid) ?? [];
      versionsOfObject.push(version);
      versionsByObjectUuid.set(version.objectUuid, versionsOfObject);
    }

    const outcomes: VersionOutcome[] = [];
    const tracesWithoutVersion: SubmissionLogTrace[] = [];

    for (const [objectUuid, versionsOfObject] of versionsByObjectUuid) {
      if (input.objectUuidsWithUnreadLogs.includes(objectUuid)) {
        for (const version of versionsOfObject) {
          outcomes.push({ version, outcome: 'UNCERTAIN', reason: 'LOGS_NOT_READ', traces: [] });
        }
        continue;
      }

      const logs = input.logs.find(result => result.lookup.objectUuid === objectUuid);
      if (!logs) {
        throw new Error(`No logs for objectUuid ${objectUuid}, and it is not in objectUuidsWithUnreadLogs`);
      }

      const coupledCorrelationIds = new Set<string>();
      for (const version of versionsOfObject) {
        const categories = categorizeTracesByObjectIndex(logs.traces, version.index);
        const traces = [...categories.tracesForRequestedIndex];
        const ambiguousTraces: SubmissionLogTrace[] = [];

        // A trace without index that started outside the registration day plus one hour belongs to another version, for example one of today.
        const registrationDay = registrationDayPlusOneHour(version.registrationAt);
        for (const trace of categories.tracesWithoutObjectIndex) {
          const startedOnRegistrationDay = trace.firstSeen >= registrationDay.fromInclusive && trace.firstSeen < registrationDay.toExclusive;
          if (!startedOnRegistrationDay) {
            continue;
          }
          if (versionsOfObject.length === 1) {
            traces.push(trace);
          } else {
            ambiguousTraces.push(trace);
          }
        }
        for (const trace of categories.otherTraces) {
          if (trace.objectIndexes.includes(version.index)) {
            ambiguousTraces.push(trace);
          }
        }

        for (const trace of [...traces, ...ambiguousTraces]) {
          coupledCorrelationIds.add(trace.correlation_id);
        }

        const versionOutcome = findVersionOutcome({
          version,
          traces: traces.sort(compareTraces),
          ambiguousTraces: ambiguousTraces.sort(compareTraces),
          queryRange: logs.queryRange,
        });
        const receiverEvents = categories.tracesForRequestedIndex.flatMap(trace => trace.receiverEvents);
        outcomes.push({
          ...versionOutcome,
          reference: receiverEvents.find(event => event.reference)?.reference,
          formName: receiverEvents.find(event => event.formName)?.formName,
        });
      }

      for (const trace of logs.traces) {
        if (!coupledCorrelationIds.has(trace.correlation_id)) {
          tracesWithoutVersion.push(trace);
        }
      }
    }

    for (const logs of input.logs) {
      if (!versionsByObjectUuid.has(logs.lookup.objectUuid)) {
        tracesWithoutVersion.push(...logs.traces);
      }
    }

    return { versions: outcomes, tracesWithoutVersion: tracesWithoutVersion.sort(compareTraces) };
  }
}

function compareVersions(a: ObjectVersion, b: ObjectVersion): number {
  if (a.objectUuid !== b.objectUuid) {
    return a.objectUuid < b.objectUuid ? -1 : 1;
  }
  return a.index - b.index;
}

// Sorting on objectUuid and correlation_id after firstSeen keeps the order the same when two traces start at the same moment.
function compareTraces(a: SubmissionLogTrace, b: SubmissionLogTrace): number {
  if (a.objectUuid !== b.objectUuid) {
    return a.objectUuid < b.objectUuid ? -1 : 1;
  }
  if (a.firstSeen.getTime() !== b.firstSeen.getTime()) {
    return a.firstSeen.getTime() - b.firstSeen.getTime();
  }
  if (a.correlation_id !== b.correlation_id) {
    return a.correlation_id < b.correlation_id ? -1 : 1;
  }
  return 0;
}
