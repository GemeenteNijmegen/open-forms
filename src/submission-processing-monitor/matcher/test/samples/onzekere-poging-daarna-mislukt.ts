/**
 * Een onzekere poging, daarna een mislukte poging.
 *
 * Bij de eerste notificatie start de receiver de Step Function, maar van die execution zijn geen events gevonden. Die poging kan dus geslaagd
 * zijn. Bij een tweede notificatie voor dezelfde index mislukt het starten. De laatste poging is mislukt, maar dat zegt niet dat de eerste niet
 * geslaagd is. De versie is dus UNCERTAIN met EXECUTION_EVENTS_NOT_FOUND, en niet PROBLEM.
 */
import { MatcherScenario } from './MatcherScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';

const objectUuid = 'inzending-onzeker-daarna-mislukt';

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
  traces: [
    {
      correlation_id: 'gestart-zonder-events',
      objectUuid,
      objectIndexes: [1],
      firstSeen: new Date('2026-11-18T09:00:00.000Z'),
      lastSeen: new Date('2026-11-18T09:00:00.500Z'),
      receiverEvents: [
        { timestamp: new Date('2026-11-18T09:00:00.000Z'), event: 'submission.notification.received', objectUuid },
        { timestamp: new Date('2026-11-18T09:00:00.100Z'), event: 'submission.object.fetch.started', objectUuid },
        { timestamp: new Date('2026-11-18T09:00:00.200Z'), event: 'submission.object.fetch.succeeded', objectUuid, objectIndex: 1 },
        { timestamp: new Date('2026-11-18T09:00:00.300Z'), event: 'submission.object.parsed', objectUuid, objectIndex: 1 },
        { timestamp: new Date('2026-11-18T09:00:00.400Z'), event: 'submission.execution.starting', objectUuid, objectIndex: 1 },
        {
          timestamp: new Date('2026-11-18T09:00:00.500Z'),
          event: 'submission.execution.started',
          objectUuid,
          objectIndex: 1,
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST20',
        },
      ],
      executions: [
        {
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST20',
          events: [],
        },
      ],
    },
    {
      correlation_id: 'start-mislukt',
      objectUuid,
      objectIndexes: [1],
      firstSeen: new Date('2026-11-18T09:05:00.000Z'),
      lastSeen: new Date('2026-11-18T09:05:00.500Z'),
      receiverEvents: [
        { timestamp: new Date('2026-11-18T09:05:00.000Z'), event: 'submission.notification.received', objectUuid },
        { timestamp: new Date('2026-11-18T09:05:00.100Z'), event: 'submission.object.fetch.started', objectUuid },
        { timestamp: new Date('2026-11-18T09:05:00.200Z'), event: 'submission.object.fetch.succeeded', objectUuid, objectIndex: 1 },
        { timestamp: new Date('2026-11-18T09:05:00.300Z'), event: 'submission.object.parsed', objectUuid, objectIndex: 1 },
        { timestamp: new Date('2026-11-18T09:05:00.400Z'), event: 'submission.execution.starting', objectUuid, objectIndex: 1 },
        { timestamp: new Date('2026-11-18T09:05:00.500Z'), event: 'submission.execution.start.failed', objectUuid, objectIndex: 1 },
      ],
      executions: [],
    },
  ],
};

export const scenario: MatcherScenario = {
  description: 'een onzekere poging met daarna een mislukte poging is onzeker, geen probleem',
  input: {
    versions: objectReaderVersions,
    logs: [logReaderResult],
    objectUuidsWithUnreadLogs: [],
  },
  expected: {
    versions: [
      {
        version: { objectUuid, index: 1 },
        outcome: 'UNCERTAIN',
        reason: 'EXECUTION_EVENTS_NOT_FOUND',
        traces: [{ correlation_id: 'gestart-zonder-events' }, { correlation_id: 'start-mislukt' }],
      },
    ],
    tracesWithoutVersion: [],
  },
};
