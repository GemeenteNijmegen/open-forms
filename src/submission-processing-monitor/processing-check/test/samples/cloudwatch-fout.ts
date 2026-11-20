/**
 * CloudWatch geeft een fout bij het lezen van de logs van één inzending.
 *
 * Twee inzendingen op 18 november. De logs van de eerste worden gelezen: verwerkt. Bij de tweede gooit de log reader. Die inzending wordt
 * UNCERTAIN met LOGS_NOT_READ, niet PROBLEM: er is niets misgegaan dat we weten. De dag is INCOMPLETE met LOGS_NOT_READ, en beide inzendingen
 * staan in de tabel.
 */
import { RunScenario } from './RunScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';

// Wat de object reader teruggeeft voor 18 november.
const versionRead: ObjectVersion = {
  objectUuid: 'inzending-gelezen',
  objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
  objectTypeName: 'submission',
  index: 1,
  registrationAt: '2026-11-18',
};
const versionNotRead: ObjectVersion = {
  objectUuid: 'inzending-niet-gelezen',
  objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
  objectTypeName: 'submission',
  index: 1,
  registrationAt: '2026-11-18',
};

// Wat de log reader teruggeeft voor de eerste inzending; voor de tweede gooit hij.
const logReaderResult: SubmissionLogUuidResult = {
  lookup: { objectUuid: 'inzending-gelezen' },
  queryRange: { fromInclusive: new Date('2026-11-17T23:00:00Z'), toExclusive: new Date('2026-11-20T06:00:00Z') },
  traces: [
    {
      correlation_id: 'notificatie-inzending-gelezen',
      objectUuid: 'inzending-gelezen',
      objectIndexes: [1],
      firstSeen: new Date('2026-11-18T09:00:00.000Z'),
      lastSeen: new Date('2026-11-18T09:00:00.500Z'),
      receiverEvents: [
        { timestamp: new Date('2026-11-18T09:00:00.000Z'), event: 'submission.notification.received', objectUuid: 'inzending-gelezen' },
        { timestamp: new Date('2026-11-18T09:00:00.100Z'), event: 'submission.object.fetch.started', objectUuid: 'inzending-gelezen' },
        { timestamp: new Date('2026-11-18T09:00:00.200Z'), event: 'submission.object.fetch.succeeded', objectUuid: 'inzending-gelezen', objectIndex: 1 },
        { timestamp: new Date('2026-11-18T09:00:00.300Z'), event: 'submission.object.parsed', objectUuid: 'inzending-gelezen', objectIndex: 1 },
        { timestamp: new Date('2026-11-18T09:00:00.400Z'), event: 'submission.execution.starting', objectUuid: 'inzending-gelezen', objectIndex: 1 },
        {
          timestamp: new Date('2026-11-18T09:00:00.500Z'),
          event: 'submission.execution.started',
          objectUuid: 'inzending-gelezen',
          objectIndex: 1,
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST12',
        },
      ],
      executions: [
        {
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST12',
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
  description: 'een CloudWatch-fout bij één inzending maakt die UNCERTAIN en de dag INCOMPLETE',
  event: { firstDay: '2026-11-18', lastDay: '2026-11-18' },
  historiesBefore: [],
  objectReaderVersionsPerDay: { '2026-11-18': [versionRead, versionNotRead] },
  objectsApiFails: false,
  logReaderResults: [logReaderResult],
  logReadFailsFor: ['inzending-niet-gelezen'],
  remainingTimeInMillis: [600_000],
  expected: {
    report: {
      status: 'INCOMPLETE',
      days: [{ day: '2026-11-18', status: 'INCOMPLETE', reason: 'LOGS_NOT_READ' }],
      totals: { submission: { objects: 2, versions: 2, PROCESSED: 1, UNCERTAIN: 1 } },
      notOkObjectUuids: ['inzending-niet-gelezen'],
    },
    histories: [
      { objectUuid: 'inzending-gelezen', objectOutcome: 'PROCESSED', versions: [{ index: 1, outcome: 'PROCESSED' }] },
      { objectUuid: 'inzending-niet-gelezen', objectOutcome: 'UNCERTAIN', versions: [{ index: 1, outcome: 'UNCERTAIN', reason: 'LOGS_NOT_READ' }] },
    ],
  },
};
