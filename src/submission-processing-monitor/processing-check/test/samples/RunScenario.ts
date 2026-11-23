import { ProcessingOutcome, ProcessingReason } from '../../../matcher/SubmissionProcessingMatcher';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';
import { ProcessingCheckEvent } from '../../ProcessingCheck';
import { RunReport } from '../../report/RunReport';
import { SubmissionProcessingHistory } from '../../store/SubmissionProcessingHistory';

// One sample file is one run: what the table and the readers hold, and what the run must report and store.
export interface RunScenario {
  description: string;
  event: ProcessingCheckEvent;
  historiesBefore: SubmissionProcessingHistory[];
  // What new ObjectReader().findVersions({ firstDay, lastDay }) returns for the period, written per day.
  objectReaderVersionsPerDay: Record<string, ObjectVersion[]>;
  // When true, findVersions throws.
  objectsApiFails: boolean;
  // What the log reader returns per objectUuid, as findByObjectUuid({ objectUuid, range }) gives it.
  logReaderResults: SubmissionLogUuidResult[];
  // objectUuids whose logs cannot be read.
  logReadFailsFor: string[];
  // Lambda time left at each call to getRemainingTimeInMillis, in order. The last value repeats.
  remainingTimeInMillis: number[];
  // Compared with toMatchObject: only these fields are checked. histories are sorted on objectUuid.
  expected: {
    report: Pick<RunReport, 'status' | 'days' | 'totals' | 'notOkObjectUuids'>;
    histories: {
      objectUuid: string;
      reference?: string;
      objectOutcome: ProcessingOutcome;
      versions: { index: number; outcome: ProcessingOutcome; reason?: ProcessingReason }[];
      firstCheckedAt?: unknown;
      firstProblemAt?: unknown;
      resolvedAt?: unknown;
    }[];
  };
}
