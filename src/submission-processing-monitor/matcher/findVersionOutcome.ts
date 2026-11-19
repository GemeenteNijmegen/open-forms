import type { VersionOutcome } from './SubmissionProcessingMatcher';
import type { ObjectVersion } from '../object-reader/ObjectReader';
import type { AbsoluteTimeRange, SubmissionLogTrace } from '../submission-log-reader/SubmissionLogReaderTypes';

export interface VersionTraces {
  version: ObjectVersion;
  // Traces that belong to this version for sure, sorted on firstSeen.
  traces: SubmissionLogTrace[];
  // Traces that may belong to this version or another one: no index while the Object has more versions, or more than one index.
  ambiguousTraces: SubmissionLogTrace[];
  // The time range in which the logs of this Object were read.
  queryRange: AbsoluteTimeRange;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function findVersionOutcome(versionTraces: VersionTraces): VersionOutcome {
  throw new Error('findVersionOutcome is not implemented');
}
