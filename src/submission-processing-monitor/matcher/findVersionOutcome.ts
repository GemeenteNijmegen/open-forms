import type { ProcessingOutcome, ProcessingReason, VersionOutcome } from './SubmissionProcessingMatcher';
import { SubmissionExecutionEvent, SubmissionLogEvent } from '../../shared/submission-logging/SubmissionLogging';
import type { ObjectVersion } from '../object-reader/ObjectReader';
import type { AbsoluteTimeRange, SubmissionExecutionTrace, SubmissionLogTrace } from '../submission-log-reader/SubmissionLogReaderTypes';
import { amsterdamCalendarDayToAbsoluteTimeRange } from '../time-range/AmsterdamTimeRange';

export interface VersionTraces {
  version: ObjectVersion;
  // Traces that belong to this version for sure, sorted on firstSeen.
  traces: SubmissionLogTrace[];
  // Traces that may belong to this version or another one: no index while the Object has more versions, or more than one index.
  ambiguousTraces: SubmissionLogTrace[];
  // The time range in which the logs of this Object were read.
  queryRange: AbsoluteTimeRange;
}

interface Judgement {
  outcome: ProcessingOutcome;
  reason?: ProcessingReason;
}

const ONE_HOUR_IN_MS = 60 * 60 * 1000;

// The registration day in Amsterdam plus one hour: the receiver handles a notification within seconds, also for a version of 23:59.
export function registrationDayPlusOneHour(registrationAt: string): AbsoluteTimeRange {
  const registrationDay = amsterdamCalendarDayToAbsoluteTimeRange(registrationAt);
  return {
    fromInclusive: registrationDay.fromInclusive,
    toExclusive: new Date(registrationDay.toExclusive.getTime() + ONE_HOUR_IN_MS),
  };
}

export function findVersionOutcome(versionTraces: VersionTraces): VersionOutcome {
  const judgement = judgeVersion(versionTraces);
  return {
    version: versionTraces.version,
    outcome: judgement.outcome,
    reason: judgement.reason,
    traces: [...versionTraces.traces, ...versionTraces.ambiguousTraces],
  };
}

function judgeVersion(versionTraces: VersionTraces): Judgement {
  const { version, traces, ambiguousTraces, queryRange } = versionTraces;

  // Same rule as ObjectParser.guardForwardableTask in the receiver: only afgerond is forwarded.
  if (version.objectTypeName === 'esfTaak') {
    if (version.esfStatus === 'open' || version.esfStatus === 'verwerkt' || version.esfStatus === 'gesloten') {
      return { outcome: 'IGNORED' };
    }
    if (version.esfStatus !== 'afgerond') {
      return { outcome: 'UNCERTAIN', reason: 'UNKNOWN_ESF_STATUS' };
    }
  }

  let judgement: Judgement | undefined;
  if (traces.length > 0) {
    judgement = judgeTraces(traces);
  }

  if (judgement?.outcome === 'PROCESSED' || judgement?.outcome === 'PROCESSED_AFTER_REDRIVE' || judgement?.outcome === 'IN_PROGRESS') {
    return judgement;
  }

  // A success in an ambiguous trace is no proof for this version, but a failure may not be blamed on it either.
  if (ambiguousTraces.length > 0 && (judgement === undefined || judgement.outcome === 'PROBLEM')) {
    return { outcome: 'UNCERTAIN', reason: 'TRACE_FITS_MULTIPLE_VERSIONS' };
  }

  if (judgement === undefined) {
    judgement = { outcome: 'PROBLEM', reason: 'NO_NOTIFICATION' };
  }

  // Missing events are only a problem when the logs cover the registration day plus an hour.
  if (judgement.reason === 'NO_NOTIFICATION' || judgement.reason === 'EXECUTION_NOT_STARTED') {
    if (!coversRegistrationDay(queryRange, version.registrationAt)) {
      return { outcome: 'UNCERTAIN', reason: 'LOGS_TIME_RANGE_TOO_SHORT' };
    }
  }

  return judgement;
}

// One success is enough. Otherwise a running execution, otherwise an uncertain trace (it may have succeeded), otherwise the last trace on firstSeen.
function judgeTraces(traces: SubmissionLogTrace[]): Judgement {
  const judgements: Judgement[] = [];
  for (const trace of traces) {
    judgements.push(judgeTrace(trace));
  }

  for (const judgement of judgements) {
    if (judgement.outcome === 'PROCESSED') {
      return judgement;
    }
  }
  for (const judgement of judgements) {
    if (judgement.outcome === 'PROCESSED_AFTER_REDRIVE') {
      return judgement;
    }
  }
  for (const judgement of judgements) {
    if (judgement.outcome === 'IN_PROGRESS') {
      return judgement;
    }
  }
  for (const judgement of judgements) {
    if (judgement.outcome === 'UNCERTAIN') {
      return judgement;
    }
  }
  return judgements[judgements.length - 1];
}

function judgeTrace(trace: SubmissionLogTrace): Judgement {
  if (trace.executions.length > 0) {
    const judgements: Judgement[] = [];
    for (const execution of trace.executions) {
      judgements.push(judgeExecution(execution));
    }
    for (const judgement of judgements) {
      if (judgement.outcome === 'PROCESSED') {
        return judgement;
      }
    }
    for (const judgement of judgements) {
      if (judgement.outcome === 'PROCESSED_AFTER_REDRIVE') {
        return judgement;
      }
    }
    for (const judgement of judgements) {
      if (judgement.outcome === 'IN_PROGRESS') {
        return judgement;
      }
    }
    for (const judgement of judgements) {
      if (judgement.outcome === 'UNCERTAIN') {
        return judgement;
      }
    }
    return judgements[judgements.length - 1];
  }

  const events: string[] = [];
  for (const receiverEvent of trace.receiverEvents) {
    if (receiverEvent.event) {
      events.push(receiverEvent.event);
    }
  }

  // A trace stops at its first failure, so the checks follow the order of the receiver.
  if (events.includes(SubmissionLogEvent.OBJECT_FETCH_FAILED)) {
    return { outcome: 'PROBLEM', reason: 'OBJECT_FETCH_FAILED' };
  }
  if (events.includes(SubmissionLogEvent.OBJECT_PARSE_FAILED)) {
    return { outcome: 'PROBLEM', reason: 'OBJECT_PARSE_FAILED' };
  }
  // For a version that should be processed, the receiver can only ignore it for an unknown object type: an esfTaak with this index is afgerond.
  if (events.includes(SubmissionLogEvent.OBJECT_IGNORED)) {
    return { outcome: 'PROBLEM', reason: 'OBJECT_TYPE_UNKNOWN_AT_RECEIVER' };
  }
  if (events.includes(SubmissionLogEvent.EXECUTION_START_FAILED)) {
    return { outcome: 'PROBLEM', reason: 'EXECUTION_START_FAILED' };
  }
  // The receiver started the execution but logged no execution_arn, so its events cannot be found.
  if (events.includes(SubmissionLogEvent.EXECUTION_STARTED)) {
    return { outcome: 'UNCERTAIN', reason: 'EXECUTION_EVENTS_NOT_FOUND' };
  }
  return { outcome: 'PROBLEM', reason: 'EXECUTION_NOT_STARTED' };
}

// The last end event counts. ExecutionRedriven after it means the execution runs again.
function judgeExecution(execution: SubmissionExecutionTrace): Judgement {
  if (execution.events.length === 0) {
    return { outcome: 'UNCERTAIN', reason: 'EXECUTION_EVENTS_NOT_FOUND' };
  }

  let judgement: Judgement = { outcome: 'IN_PROGRESS' };
  for (const event of execution.events) {
    if (event.type === SubmissionExecutionEvent.SUCCEEDED) {
      const redriven = event.redriveCount !== undefined && event.redriveCount > 0;
      judgement = { outcome: redriven ? 'PROCESSED_AFTER_REDRIVE' : 'PROCESSED' };
    } else if (event.type === SubmissionExecutionEvent.FAILED) {
      judgement = { outcome: 'PROBLEM', reason: 'EXECUTION_FAILED' };
    } else if (event.type === SubmissionExecutionEvent.TIMED_OUT) {
      judgement = { outcome: 'PROBLEM', reason: 'EXECUTION_TIMED_OUT' };
    } else if (event.type === SubmissionExecutionEvent.ABORTED) {
      judgement = { outcome: 'PROBLEM', reason: 'EXECUTION_ABORTED' };
    } else if (event.type === 'ExecutionRedriven') {
      judgement = { outcome: 'IN_PROGRESS' };
    }
  }
  return judgement;
}

function coversRegistrationDay(queryRange: AbsoluteTimeRange, registrationAt: string): boolean {
  const registrationDay = registrationDayPlusOneHour(registrationAt);
  const startsInTime = queryRange.fromInclusive.getTime() <= registrationDay.fromInclusive.getTime();
  const endsLateEnough = queryRange.toExclusive.getTime() >= registrationDay.toExclusive.getTime();
  return startsInTime && endsLateEnough;
}
