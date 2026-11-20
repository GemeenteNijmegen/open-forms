/**
 * De Objects API geeft een fout op de tweede dag van de periode.
 *
 * De run controleert 18 en 19 november. Op 18 november gaat alles goed. Op 19 november gooit de object reader. Die dag wordt INCOMPLETE met
 * OBJECTS_API_FAILED en er wordt niets van opgeslagen, ook geen lege telling. Wat op 18 november gevonden is, blijft gewoon staan.
 */
import { RunScenario } from './RunScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';

// Wat de object reader teruggeeft voor 18 november; op 19 november gooit hij.
const version: ObjectVersion = {
  objectUuid: 'inzending-dag-een',
  objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
  objectTypeName: 'submission',
  index: 1,
  registrationAt: '2026-11-18',
};

// Wat de log reader teruggeeft.
const logReaderResult: SubmissionLogUuidResult = {
  lookup: { objectUuid: 'inzending-dag-een' },
  queryRange: { fromInclusive: new Date('2026-11-17T23:00:00Z'), toExclusive: new Date('2026-11-20T06:00:00Z') },
  traces: [
    {
      correlation_id: 'notificatie-inzending-dag-een',
      objectUuid: 'inzending-dag-een',
      objectIndexes: [1],
      firstSeen: new Date('2026-11-18T09:00:00.000Z'),
      lastSeen: new Date('2026-11-18T09:00:00.500Z'),
      receiverEvents: [
        { timestamp: new Date('2026-11-18T09:00:00.000Z'), event: 'submission.notification.received', objectUuid: 'inzending-dag-een' },
        { timestamp: new Date('2026-11-18T09:00:00.100Z'), event: 'submission.object.fetch.started', objectUuid: 'inzending-dag-een' },
        { timestamp: new Date('2026-11-18T09:00:00.200Z'), event: 'submission.object.fetch.succeeded', objectUuid: 'inzending-dag-een', objectIndex: 1 },
        { timestamp: new Date('2026-11-18T09:00:00.300Z'), event: 'submission.object.parsed', objectUuid: 'inzending-dag-een', objectIndex: 1 },
        { timestamp: new Date('2026-11-18T09:00:00.400Z'), event: 'submission.execution.starting', objectUuid: 'inzending-dag-een', objectIndex: 1 },
        {
          timestamp: new Date('2026-11-18T09:00:00.500Z'),
          event: 'submission.execution.started',
          objectUuid: 'inzending-dag-een',
          objectIndex: 1,
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST13',
        },
      ],
      executions: [
        {
          execution_arn: 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST13',
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
  description: 'een fout van de Objects API op dag twee laat dag één staan',
  event: { firstDay: '2026-11-18', lastDay: '2026-11-19' },
  historiesBefore: [],
  objectReaderVersionsPerDay: { '2026-11-18': [version] },
  objectsApiFailsOn: ['2026-11-19'],
  logReaderResults: [logReaderResult],
  logReadFailsFor: [],
  remainingTimeInMillis: [600_000],
  expected: {
    report: {
      status: 'INCOMPLETE',
      days: [{ day: '2026-11-18', status: 'COMPLETE' }, { day: '2026-11-19', status: 'INCOMPLETE', reason: 'OBJECTS_API_FAILED' }],
      totals: { submission: { objects: 1, versions: 1, PROCESSED: 1 } },
      notOkObjectUuids: [],
    },
    histories: [
      { objectUuid: 'inzending-dag-een', objectOutcome: 'PROCESSED', versions: [{ index: 1, outcome: 'PROCESSED' }] },
    ],
  },
};
