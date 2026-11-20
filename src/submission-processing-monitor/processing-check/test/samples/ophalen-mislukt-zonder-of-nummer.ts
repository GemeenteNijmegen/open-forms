/**
 * Het ophalen van het Object mislukt, dus er is geen OF-nummer.
 *
 * De receiver kon het Object niet ophalen en logde daarom geen index, OF-nummer of formuliernaam. De inzending is PROBLEM met
 * OBJECT_FETCH_FAILED. De geschiedenis wordt gewoon opgeslagen, met de objectUuid en zonder reference en formName.
 */
import { RunScenario } from './RunScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';

const objectUuid = 'inzending-zonder-of-nummer';

// Wat de object reader teruggeeft voor 18 november.
const version: ObjectVersion = {
  objectUuid,
  objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
  objectTypeName: 'submission',
  index: 1,
  registrationAt: '2026-11-18',
};

// Wat de log reader teruggeeft, van 18 november 00:00 tot de ochtendrun van 19 november (Amsterdam).
const logReaderResult: SubmissionLogUuidResult = {
  lookup: { objectUuid },
  queryRange: { fromInclusive: new Date('2026-11-17T23:00:00Z'), toExclusive: new Date('2026-11-19T06:00:00Z') },
  traces: [
    {
      correlation_id: 'notificatie',
      objectUuid,
      objectIndexes: [],
      firstSeen: new Date('2026-11-18T09:00:00.000Z'),
      lastSeen: new Date('2026-11-18T09:00:00.200Z'),
      receiverEvents: [
        { timestamp: new Date('2026-11-18T09:00:00.000Z'), event: 'submission.notification.received', objectUuid },
        { timestamp: new Date('2026-11-18T09:00:00.100Z'), event: 'submission.object.fetch.started', objectUuid },
        { timestamp: new Date('2026-11-18T09:00:00.200Z'), event: 'submission.object.fetch.failed', objectUuid },
      ],
      executions: [],
    },
  ],
};

export const scenario: RunScenario = {
  description: 'een inzending zonder OF-nummer wordt opgeslagen met alleen de objectUuid',
  event: { firstDay: '2026-11-18', lastDay: '2026-11-18' },
  historiesBefore: [],
  objectReaderVersionsPerDay: { '2026-11-18': [version] },
  objectsApiFailsOn: [],
  logReaderResults: [logReaderResult],
  logReadFailsFor: [],
  remainingTimeInMillis: [600_000],
  expected: {
    report: {
      status: 'COMPLETE',
      days: [{ day: '2026-11-18', status: 'COMPLETE' }],
      totals: { submission: { objects: 1, versions: 1, PROBLEM: 1 } },
      notOkObjectUuids: [objectUuid],
    },
    histories: [
      {
        objectUuid,
        objectOutcome: 'PROBLEM',
        versions: [{ index: 1, outcome: 'PROBLEM', reason: 'OBJECT_FETCH_FAILED' }],
        firstProblemAt: expect.any(String),
      },
    ],
  },
};
