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
  // What new ObjectReader().findVersions({ firstDay: day, lastDay: day }) returns per day.
  objectReaderVersionsPerDay: Record<string, ObjectVersion[]>;
  // Days on which findVersions throws.
  objectsApiFailsOn: string[];
  // What new CloudWatchSubmissionLogReader().findByObjectUuid({ objectUuid, range }) returns per objectUuid.
  logReaderResults: SubmissionLogUuidResult[];
  // objectUuids for which findByObjectUuid throws.
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
