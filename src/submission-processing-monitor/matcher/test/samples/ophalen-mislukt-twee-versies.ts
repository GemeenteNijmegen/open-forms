/**
 * Het ophalen van het Object mislukt, bij een Object met twee versies.
 *
 * Versie 1 heeft een eigen geslaagde verwerking. Voor versie 2 is er alleen de mislukte trace zonder index, en die kan net zo goed bij versie 1
 * horen. De matcher gokt niet: versie 1 blijft PROCESSED, versie 2 wordt UNCERTAIN met TRACE_FITS_MULTIPLE_VERSIONS. De trace staat bij beide.
 */
import { MatcherScenario } from './MatcherScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';

const objectUuid = 'inzending-twee-versies';

// Wat de object reader teruggeeft: new ObjectReader().findVersions({ firstDay: '2026-11-18', lastDay: '2026-11-18' })
const objectReaderVersions: ObjectVersion[] = [
  {
    objectUuid,
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
    objectTypeName: 'submission',
    index: 1,
    registrationAt: '2026-11-18',
  },
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
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST06',
        },
      ],
      executions: [
        {
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST06',
          events: [
            { timestamp: new Date('2026-11-18T09:00:00.600Z'), type: 'ExecutionStarted', id: 1, redriveCount: 0 },
            { timestamp: new Date('2026-11-18T09:00:01.100Z'), type: 'ExecutionSucceeded', id: 2, redriveCount: 0 },
          ],
        },
      ],
    },
    {
      correlation_id: 'notificatie-ophalen-mislukt',
      objectUuid,
      objectIndexes: [],
      firstSeen: new Date('2026-11-18T14:00:00.000Z'),
      lastSeen: new Date('2026-11-18T14:00:00.200Z'),
      receiverEvents: [
        { timestamp: new Date('2026-11-18T14:00:00.000Z'), event: 'submission.notification.received', objectUuid },
        { timestamp: new Date('2026-11-18T14:00:00.100Z'), event: 'submission.object.fetch.started', objectUuid },
        { timestamp: new Date('2026-11-18T14:00:00.200Z'), event: 'submission.object.fetch.failed', objectUuid },
      ],
      executions: [],
    },
  ],
};

export const scenario: MatcherScenario = {
  description: 'ophalen mislukt zonder index bij een Object met twee versies wordt aan geen van beide toegeschreven',
  input: {
    versions: objectReaderVersions,
    logs: [logReaderResult],
    objectUuidsWithUnreadLogs: [],
  },
  expected: {
    versions: [
      {
        version: { objectUuid, index: 1 },
        outcome: 'PROCESSED',
        traces: [
          { correlation_id: 'notificatie-versie-1' },
          { correlation_id: 'notificatie-ophalen-mislukt' },
        ],
      },
      {
        version: { objectUuid, index: 2 },
        outcome: 'UNCERTAIN',
        reason: 'TRACE_FITS_MULTIPLE_VERSIONS',
        traces: [
          { correlation_id: 'notificatie-ophalen-mislukt' },
        ],
      },
    ],
    tracesWithoutVersion: [],
  },
};
