/**
 * De Lambda-tijd raakt op halverwege een dag.
 *
 * De run controleert 18 en 19 november; op 18 november zijn er twee inzendingen. Bij de eerste is er nog genoeg tijd. Voor de tweede zijn er
 * minder dan 3 minuten over, dus die wordt niet meer gelezen. Hij wordt ook niet UNCERTAIN, want hij is niet gecontroleerd. Beide dagen zijn
 * INCOMPLETE met OUT_OF_TIME; 19 november is niet meer begonnen.
 */
import { RunScenario } from './RunScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';

// Wat de object reader teruggeeft voor 18 november.
const versionInTime: ObjectVersion = {
  objectUuid: 'inzending-op-tijd',
  objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
  objectTypeName: 'submission',
  index: 1,
  registrationAt: '2026-11-18',
};
const versionTooLate: ObjectVersion = {
  objectUuid: 'inzending-te-laat',
  objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
  objectTypeName: 'submission',
  index: 1,
  registrationAt: '2026-11-18',
};

// Wat de log reader teruggeeft voor de eerste inzending. De tweede wordt niet meer gevraagd.
const logReaderResult: SubmissionLogUuidResult = {
  lookup: { objectUuid: 'inzending-op-tijd' },
  queryRange: { fromInclusive: new Date('2026-11-17T23:00:00Z'), toExclusive: new Date('2026-11-20T06:00:00Z') },
  traces: [
    {
      correlation_id: 'notificatie-inzending-op-tijd',
      objectUuid: 'inzending-op-tijd',
      objectIndexes: [1],
      firstSeen: new Date('2026-11-18T09:00:00.000Z'),
      lastSeen: new Date('2026-11-18T09:00:00.500Z'),
      receiverEvents: [
        { timestamp: new Date('2026-11-18T09:00:00.000Z'), event: 'submission.notification.received', objectUuid: 'inzending-op-tijd' },
        { timestamp: new Date('2026-11-18T09:00:00.100Z'), event: 'submission.object.fetch.started', objectUuid: 'inzending-op-tijd' },
        { timestamp: new Date('2026-11-18T09:00:00.200Z'), event: 'submission.object.fetch.succeeded', objectUuid: 'inzending-op-tijd', objectIndex: 1 },
        { timestamp: new Date('2026-11-18T09:00:00.300Z'), event: 'submission.object.parsed', objectUuid: 'inzending-op-tijd', objectIndex: 1 },
        { timestamp: new Date('2026-11-18T09:00:00.400Z'), event: 'submission.execution.starting', objectUuid: 'inzending-op-tijd', objectIndex: 1 },
        {
          timestamp: new Date('2026-11-18T09:00:00.500Z'),
          event: 'submission.execution.started',
          objectUuid: 'inzending-op-tijd',
          objectIndex: 1,
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST14',
        },
      ],
      executions: [
        {
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST14',
          events: [
            { timestamp: new Date('2026-11-18T09:00:00.600Z'), type: 'ExecutionStarted', id: 1, redriveCount: 0 },
            { timestamp: new Date('2026-11-18T09:00:01.600Z'), type: 'ExecutionSucceeded', id: 2, redriveCount: 0 },
          ],
        },
      ],
    },
  ],
};

export const scenario: RunScenario = {
  description: 'als de tijd op is, stopt de run tussen twee inzendingen en worden de overige dagen OUT_OF_TIME',
  event: { firstDay: '2026-11-18', lastDay: '2026-11-19' },
  historiesBefore: [],
  objectReaderVersionsPerDay: { '2026-11-18': [versionInTime, versionTooLate] },
  objectsApiFails: false,
  logReaderResults: [logReaderResult],
  logReadFailsFor: [],
  // Start van de dag, de eerste inzending, dan nog 1 minuut.
  remainingTimeInMillis: [600_000, 600_000, 60_000],
  expected: {
    report: {
      status: 'INCOMPLETE',
      days: [{ day: '2026-11-18', status: 'INCOMPLETE', reason: 'OUT_OF_TIME' }, { day: '2026-11-19', status: 'INCOMPLETE', reason: 'OUT_OF_TIME' }],
      totals: { submission: { objects: 1, versions: 1, PROCESSED: 1 } },
      notOkObjectUuids: [],
    },
    histories: [
      { objectUuid: 'inzending-op-tijd', objectOutcome: 'PROCESSED', versions: [{ index: 1, outcome: 'PROCESSED' }] },
    ],
  },
};
