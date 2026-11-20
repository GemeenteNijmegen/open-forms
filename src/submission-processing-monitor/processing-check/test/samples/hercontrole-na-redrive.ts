/**
 * Een hercontrole van een dag, nadat het probleem met een redrive is opgelost.
 *
 * De eerste run vond op 18 november een mislukte Step Function: PROBLEM. Daarna is de execution vanuit de console geredrived en geslaagd. Bij de
 * hercontrole van dezelfde dag wordt de versie vervangen, niet dubbel opgeslagen. firstProblemAt blijft staan en resolvedAt komt erbij. In het
 * rapport staat de inzending nog wel, omdat iemand moest ingrijpen.
 */
import { RunScenario } from './RunScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';
import { SubmissionProcessingHistory } from '../../store/SubmissionProcessingHistory';

const objectUuid = 'inzending-hercontrole';
const executionArn = 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST11';

// Wat de eerste run opsloeg.
const historyBefore: SubmissionProcessingHistory = {
  objectUuid,
  objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
  objectTypeName: 'submission',
  reference: 'OF-TEST11',
  objectOutcome: 'PROBLEM',
  versions: [
    {
      index: 1,
      registrationAt: '2026-11-18',
      outcome: 'PROBLEM',
      reason: 'EXECUTION_FAILED',
      correlationIds: ['notificatie'],
      executionArns: [executionArn],
    },
  ],
  firstCheckedAt: '2026-11-19T06:00:12.000Z',
  lastCheckedAt: '2026-11-19T06:00:12.000Z',
  runId: 'eerste-run',
  firstProblemAt: '2026-11-19T06:00:12.000Z',
};

// Wat de object reader teruggeeft voor 18 november.
const version: ObjectVersion = {
  objectUuid,
  objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
  objectTypeName: 'submission',
  index: 1,
  registrationAt: '2026-11-18',
};

// Wat de log reader nu teruggeeft: dezelfde execution, na de redrive geslaagd.
const logReaderResult: SubmissionLogUuidResult = {
  lookup: { objectUuid },
  queryRange: { fromInclusive: new Date('2026-11-17T23:00:00Z'), toExclusive: new Date('2026-11-20T06:00:00Z') },
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
        { timestamp: new Date('2026-11-18T09:00:00.500Z'), event: 'submission.execution.started', objectUuid, objectIndex: 1, execution_arn: executionArn },
      ],
      executions: [
        {
          execution_arn: executionArn,
          events: [
            { timestamp: new Date('2026-11-18T09:00:00.600Z'), type: 'ExecutionStarted', id: 1, redriveCount: 0 },
            { timestamp: new Date('2026-11-18T09:00:01.100Z'), type: 'ExecutionFailed', id: 2, redriveCount: 1 },
            { timestamp: new Date('2026-11-19T10:00:00.000Z'), type: 'ExecutionRedriven', id: 3, redriveCount: 1 },
            { timestamp: new Date('2026-11-19T10:00:01.000Z'), type: 'ExecutionSucceeded', id: 4, redriveCount: 1 },
          ],
        },
      ],
    },
  ],
};

export const scenario: RunScenario = {
  description: 'een hercontrole na een redrive vervangt de versie, houdt firstProblemAt en zet resolvedAt',
  event: { firstDay: '2026-11-18', lastDay: '2026-11-18' },
  historiesBefore: [historyBefore],
  objectReaderVersionsPerDay: { '2026-11-18': [version] },
  objectsApiFailsOn: [],
  logReaderResults: [logReaderResult],
  logReadFailsFor: [],
  remainingTimeInMillis: [600_000],
  expected: {
    report: {
      status: 'COMPLETE',
      days: [{ day: '2026-11-18', status: 'COMPLETE' }],
      totals: { submission: { objects: 1, versions: 1, PROCESSED_AFTER_REDRIVE: 1 } },
      notOkObjectUuids: [objectUuid],
    },
    histories: [
      {
        objectUuid,
        reference: 'OF-TEST11',
        objectOutcome: 'PROCESSED_AFTER_REDRIVE',
        versions: [{ index: 1, outcome: 'PROCESSED_AFTER_REDRIVE' }],
        firstCheckedAt: '2026-11-19T06:00:12.000Z',
        firstProblemAt: '2026-11-19T06:00:12.000Z',
        resolvedAt: expect.any(String),
      },
    ],
  },
};
