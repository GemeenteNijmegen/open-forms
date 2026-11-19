/**
 * Een ESF-taak met een status die de receiver niet kent.
 *
 * De matcher weet dan niet of de versie verwerkt had moeten worden, en verzint geen verwachting: UNCERTAIN met UNKNOWN_ESF_STATUS.
 */
import { MatcherScenario } from './MatcherScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';

const objectUuid = 'esf-taak-onbekende-status';

// Wat de object reader teruggeeft: new ObjectReader().findVersions({ firstDay: '2026-11-18', lastDay: '2026-11-18' })
const objectReaderVersions: ObjectVersion[] = [
  {
    objectUuid,
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/esf-taak',
    objectTypeName: 'esfTaak',
    index: 1,
    registrationAt: '2026-11-18',
    esfStatus: 'in behandeling',
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
  description: 'bij een onbekende ESF-status zegt de matcher niet of verwerking nodig was',
  input: {
    versions: objectReaderVersions,
    logs: [logReaderResult],
    objectUuidsWithUnreadLogs: [],
  },
  expected: {
    versions: [
      { version: { objectUuid, index: 1 }, outcome: 'UNCERTAIN', reason: 'UNKNOWN_ESF_STATUS', traces: [] },
    ],
    tracesWithoutVersion: [],
  },
};
