/**
 * Een normale ESF-taak met drie versies op één dag.
 *
 * Versie 1 (open) wordt aangemaakt en hoeft niet door; daar is ook geen notificatie voor nodig. Versie 2 (afgerond) is het ingediende formulier:
 * de receiver start de Step Function en die slaagt. Daarna zet de ESB de taak op verwerkt (versie 3); die notificatie wordt door de receiver
 * genegeerd. Alleen afgerond moet verwerkt worden, dus: IGNORED, PROCESSED, IGNORED.
 */
import { MatcherScenario } from './MatcherScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';

const objectUuid = 'esf-taak-normaal';

// Wat de object reader teruggeeft: new ObjectReader().findVersions({ firstDay: '2026-11-18', lastDay: '2026-11-18' })
const objectReaderVersions: ObjectVersion[] = [
  {
    objectUuid,
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/esf-taak',
    objectTypeName: 'esfTaak',
    index: 1,
    registrationAt: '2026-11-18',
    esfStatus: 'open',
  },
  {
    objectUuid,
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/esf-taak',
    objectTypeName: 'esfTaak',
    index: 2,
    registrationAt: '2026-11-18',
    esfStatus: 'afgerond',
  },
  {
    objectUuid,
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/esf-taak',
    objectTypeName: 'esfTaak',
    index: 3,
    registrationAt: '2026-11-18',
    esfStatus: 'verwerkt',
  },
];

// Wat de log reader teruggeeft: new CloudWatchSubmissionLogReader().findByObjectUuid({ objectUuid, range }),
// met range van 18 november 00:00 tot 19 november 07:00 (Amsterdam), zoals de ochtendrun.
const logReaderResult: SubmissionLogUuidResult = {
  lookup: { objectUuid },
  queryRange: { fromInclusive: new Date('2026-11-17T23:00:00Z'), toExclusive: new Date('2026-11-19T06:00:00Z') },
  traces: [
    {
      correlation_id: 'notificatie-afgerond',
      objectUuid,
      objectIndexes: [2],
      firstSeen: new Date('2026-11-18T09:00:00.000Z'),
      lastSeen: new Date('2026-11-18T09:00:00.500Z'),
      receiverEvents: [
        { timestamp: new Date('2026-11-18T09:00:00.000Z'), event: 'submission.notification.received', objectUuid },
        { timestamp: new Date('2026-11-18T09:00:00.100Z'), event: 'submission.object.fetch.started', objectUuid },
        { timestamp: new Date('2026-11-18T09:00:00.200Z'), event: 'submission.object.fetch.succeeded', objectUuid, objectIndex: 2 },
        { timestamp: new Date('2026-11-18T09:00:00.300Z'), event: 'submission.object.parsed', objectUuid, objectIndex: 2 },
        { timestamp: new Date('2026-11-18T09:00:00.400Z'), event: 'submission.execution.starting', objectUuid, objectIndex: 2 },
        {
          timestamp: new Date('2026-11-18T09:00:00.500Z'),
          event: 'submission.execution.started',
          objectUuid,
          objectIndex: 2,
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST01-afgerond',
        },
      ],
      executions: [
        {
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST01-afgerond',
          events: [
            { timestamp: new Date('2026-11-18T09:00:00.600Z'), type: 'ExecutionStarted', id: 1, redriveCount: 0 },
            { timestamp: new Date('2026-11-18T09:00:01.100Z'), type: 'ExecutionSucceeded', id: 2, redriveCount: 0 },
          ],
        },
      ],
    },
    {
      correlation_id: 'notificatie-verwerkt',
      objectUuid,
      objectIndexes: [3],
      firstSeen: new Date('2026-11-18T09:00:05.000Z'),
      lastSeen: new Date('2026-11-18T09:00:05.300Z'),
      receiverEvents: [
        { timestamp: new Date('2026-11-18T09:00:05.000Z'), event: 'submission.notification.received', objectUuid },
        { timestamp: new Date('2026-11-18T09:00:05.100Z'), event: 'submission.object.fetch.started', objectUuid },
        { timestamp: new Date('2026-11-18T09:00:05.200Z'), event: 'submission.object.fetch.succeeded', objectUuid, objectIndex: 3 },
        { timestamp: new Date('2026-11-18T09:00:05.300Z'), event: 'submission.object.ignored', objectUuid, objectIndex: 3 },
      ],
      executions: [],
    },
  ],
};

export const scenario: MatcherScenario = {
  description: 'een ESF-taak wordt alleen verwerkt als hij afgerond is; open en verwerkt worden genegeerd',
  input: {
    versions: objectReaderVersions,
    logs: [logReaderResult],
    objectUuidsWithUnreadLogs: [],
  },
  expected: {
    versions: [
      { version: { objectUuid, index: 1 }, outcome: 'IGNORED', traces: [] },
      { version: { objectUuid, index: 2 }, outcome: 'PROCESSED', traces: [{ correlation_id: 'notificatie-afgerond' }] },
      { version: { objectUuid, index: 3 }, outcome: 'IGNORED', traces: [{ correlation_id: 'notificatie-verwerkt' }] },
    ],
    tracesWithoutVersion: [],
  },
};
