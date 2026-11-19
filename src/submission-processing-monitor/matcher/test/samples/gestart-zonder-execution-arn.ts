/**
 * De receiver logt een gestarte Step Function, maar zonder execution_arn.
 *
 * Step Functions geeft bij het starten normaal een execution_arn terug. Ontbreekt die in de log, dan kan de log reader de events van de
 * execution niet vinden. De receiver zegt wel dat de Step Function gestart is, dus de versie is UNCERTAIN met EXECUTION_EVENTS_NOT_FOUND,
 * en niet PROBLEM met EXECUTION_NOT_STARTED.
 */
import { MatcherScenario } from './MatcherScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';

const objectUuid = 'inzending-gestart-zonder-arn';

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
      correlation_id: 'notificatie',
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
        { timestamp: new Date('2026-11-18T09:00:00.500Z'), event: 'submission.execution.started', objectUuid, objectIndex: 1 },
      ],
      executions: [],
    },
  ],
};

export const scenario: MatcherScenario = {
  description: 'een gestarte Step Function zonder execution_arn in de log is onzeker, geen probleem',
  input: {
    versions: objectReaderVersions,
    logs: [logReaderResult],
    objectUuidsWithUnreadLogs: [],
  },
  expected: {
    versions: [
      { version: { objectUuid, index: 1 }, outcome: 'UNCERTAIN', reason: 'EXECUTION_EVENTS_NOT_FOUND', traces: [{ correlation_id: 'notificatie' }] },
    ],
    tracesWithoutVersion: [],
  },
};
