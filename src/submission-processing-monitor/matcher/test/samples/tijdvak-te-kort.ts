/**
 * Een versie zonder notificatie, maar de logs zijn maar tot middernacht gelezen.
 *
 * Een versie van 23:59 kan zijn notificatie pas na middernacht krijgen. De logs moeten tot minstens een uur na de registratiedag gelezen zijn;
 * hier is dat niet zo. Ontbrekend bewijs is geen fout: UNCERTAIN met LOGS_TIME_RANGE_TOO_SHORT.
 */
import { MatcherScenario } from './MatcherScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';

const objectUuid = 'inzending-te-kort-gelezen';

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
// met range van 18 november 00:00 tot 19 november 00:00 (Amsterdam), alleen de registratiedag.
const logReaderResult: SubmissionLogUuidResult = {
  lookup: { objectUuid },
  queryRange: { fromInclusive: new Date('2026-11-17T23:00:00Z'), toExclusive: new Date('2026-11-18T23:00:00Z') },
  traces: [],
};

export const scenario: MatcherScenario = {
  description: 'geen notificatie terwijl de logs maar tot middernacht gelezen zijn, is onzeker',
  input: {
    versions: objectReaderVersions,
    logs: [logReaderResult],
    objectUuidsWithUnreadLogs: [],
  },
  expected: {
    versions: [
      { version: { objectUuid, index: 1 }, outcome: 'UNCERTAIN', reason: 'LOGS_TIME_RANGE_TOO_SHORT', traces: [] },
    ],
    tracesWithoutVersion: [],
  },
};
