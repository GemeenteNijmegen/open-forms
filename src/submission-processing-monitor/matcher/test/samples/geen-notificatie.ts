/**
 * Een versie zonder enige notificatie, en de logs zijn tot de volgende ochtend gelezen.
 *
 * De logs dekken de registratiedag plus ruim een uur. Dan is het ontbreken van elke trace aantoonbaar: PROBLEM met NO_NOTIFICATION.
 */
import { MatcherScenario } from './MatcherScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';

const objectUuid = 'inzending-zonder-notificatie';

// Wat de object reader teruggeeft: new ObjectReader().findVersions({ firstDay: '2026-11-18', lastDay: '2026-11-18' })
const objectReaderVersions: ObjectVersion[] = [
  {
    objectUuid,
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
    objectTypeName: 'submission',
    index: 1,
    registrationAt: '2026-11-18',
  },
];

// Wat de log reader teruggeeft: new CloudWatchSubmissionLogReader().findByObjectUuid({ objectUuid, range }),
// met range van 18 november 00:00 tot 19 november 07:00 (Amsterdam), zoals de ochtendrun.
const logReaderResult: SubmissionLogUuidResult = {
  lookup: { objectUuid },
  queryRange: { fromInclusive: new Date('2026-11-17T23:00:00Z'), toExclusive: new Date('2026-11-19T06:00:00Z') },
  traces: [],
};

export const scenario: MatcherScenario = {
  description: 'geen notificatie terwijl de logs tot de volgende ochtend gelezen zijn, is een probleem',
  input: {
    versions: objectReaderVersions,
    logs: [logReaderResult],
    objectUuidsWithUnreadLogs: [],
  },
  expected: {
    versions: [
      { version: { objectUuid, index: 1 }, outcome: 'PROBLEM', reason: 'NO_NOTIFICATION', traces: [] },
    ],
    tracesWithoutVersion: [],
  },
};
