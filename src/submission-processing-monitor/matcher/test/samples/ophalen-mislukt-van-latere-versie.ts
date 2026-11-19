/**
 * Het ophalen mislukt vanochtend, voor een versie van vandaag.
 *
 * Versie 2 is gisteren geregistreerd en kreeg geen notificatie. De logs lopen tot de ochtendrun, en vanochtend om 06:30 komt een notificatie
 * binnen voor een nieuwe versie van vandaag, waarbij het ophalen mislukt. Zonder index is niet te zien bij welke versie die hoort, maar hij
 * begon ruim na de registratiedag plus een uur, dus niet bij versie 2. Versie 2 blijft PROBLEM met NO_NOTIFICATION en de trace komt in
 * tracesWithoutVersion.
 */
import { MatcherScenario } from './MatcherScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';

const objectUuid = 'inzending-ophalen-mislukt-vandaag';

// Wat de object reader teruggeeft: new ObjectReader().findVersions({ firstDay: '2026-11-18', lastDay: '2026-11-18' })
const objectReaderVersions: ObjectVersion[] = [
  {
    objectUuid,
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
    objectTypeName: 'submission',
    index: 2,
    registrationAt: '2026-11-18',
  },
];

// Wat de log reader teruggeeft: new CloudWatchSubmissionLogReader().findByObjectUuid({ objectUuid, range }),
// met range van 18 november 00:00 tot 19 november 07:00 (Amsterdam), zoals de ochtendrun.
const logReaderResult: SubmissionLogUuidResult = {
  lookup: { objectUuid },
  queryRange: { fromInclusive: new Date('2026-11-17T23:00:00Z'), toExclusive: new Date('2026-11-19T06:00:00Z') },
  traces: [
    {
      correlation_id: 'notificatie-vandaag',
      objectUuid,
      objectIndexes: [],
      firstSeen: new Date('2026-11-19T05:30:00.000Z'),
      lastSeen: new Date('2026-11-19T05:30:00.200Z'),
      receiverEvents: [
        { timestamp: new Date('2026-11-19T05:30:00.000Z'), event: 'submission.notification.received', objectUuid },
        { timestamp: new Date('2026-11-19T05:30:00.100Z'), event: 'submission.object.fetch.started', objectUuid },
        { timestamp: new Date('2026-11-19T05:30:00.200Z'), event: 'submission.object.fetch.failed', objectUuid },
      ],
      executions: [],
    },
  ],
};

export const scenario: MatcherScenario = {
  description: 'ophalen mislukt zonder index van na de registratiedag hoort niet bij de versie van gisteren',
  input: {
    versions: objectReaderVersions,
    logs: [logReaderResult],
    objectUuidsWithUnreadLogs: [],
  },
  expected: {
    versions: [
      { version: { objectUuid, index: 2 }, outcome: 'PROBLEM', reason: 'NO_NOTIFICATION', traces: [] },
    ],
    tracesWithoutVersion: [{ correlation_id: 'notificatie-vandaag' }],
  },
};
