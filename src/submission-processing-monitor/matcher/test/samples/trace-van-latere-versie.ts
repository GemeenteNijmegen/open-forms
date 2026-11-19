/**
 * In de logs staat ook een trace van een versie die niet gecontroleerd wordt.
 *
 * Versie 1 is gisteren geregistreerd en goed verwerkt. Vanochtend kwam er al een versie 2 bij; die valt buiten de periode en staat dus niet in de
 * versies, maar de logs van het Object bevatten zijn trace wel. Die trace wordt niet weggegooid en niet aan versie 1 gekoppeld: hij komt in
 * tracesWithoutVersion.
 */
import { MatcherScenario } from './MatcherScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';

const objectUuid = 'inzending-later-gewijzigd';

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
      correlation_id: 'notificatie-versie-1',
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
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST07-1',
        },
      ],
      executions: [
        {
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST07-1',
          events: [
            { timestamp: new Date('2026-11-18T09:00:00.600Z'), type: 'ExecutionStarted', id: 1, redriveCount: 0 },
            { timestamp: new Date('2026-11-18T09:00:01.100Z'), type: 'ExecutionSucceeded', id: 2, redriveCount: 0 },
          ],
        },
      ],
    },
    {
      correlation_id: 'notificatie-versie-2',
      objectUuid,
      objectIndexes: [2],
      firstSeen: new Date('2026-11-19T05:30:00.000Z'),
      lastSeen: new Date('2026-11-19T05:30:00.500Z'),
      receiverEvents: [
        { timestamp: new Date('2026-11-19T05:30:00.000Z'), event: 'submission.notification.received', objectUuid },
        { timestamp: new Date('2026-11-19T05:30:00.100Z'), event: 'submission.object.fetch.started', objectUuid },
        { timestamp: new Date('2026-11-19T05:30:00.200Z'), event: 'submission.object.fetch.succeeded', objectUuid, objectIndex: 2 },
        { timestamp: new Date('2026-11-19T05:30:00.300Z'), event: 'submission.object.parsed', objectUuid, objectIndex: 2 },
        { timestamp: new Date('2026-11-19T05:30:00.400Z'), event: 'submission.execution.starting', objectUuid, objectIndex: 2 },
        {
          timestamp: new Date('2026-11-19T05:30:00.500Z'),
          event: 'submission.execution.started',
          objectUuid,
          objectIndex: 2,
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST07-2',
        },
      ],
      executions: [
        {
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST07-2',
          events: [
            { timestamp: new Date('2026-11-19T05:30:00.600Z'), type: 'ExecutionStarted', id: 1, redriveCount: 0 },
            { timestamp: new Date('2026-11-19T05:30:01.100Z'), type: 'ExecutionSucceeded', id: 2, redriveCount: 0 },
          ],
        },
      ],
    },
  ],
};

export const scenario: MatcherScenario = {
  description: 'een trace van een versie buiten de periode komt apart in tracesWithoutVersion',
  input: {
    versions: objectReaderVersions,
    logs: [logReaderResult],
    objectUuidsWithUnreadLogs: [],
  },
  expected: {
    versions: [
      { version: { objectUuid, index: 1 }, outcome: 'PROCESSED', traces: [{ correlation_id: 'notificatie-versie-1' }] },
    ],
    tracesWithoutVersion: [{ correlation_id: 'notificatie-versie-2' }],
  },
};
