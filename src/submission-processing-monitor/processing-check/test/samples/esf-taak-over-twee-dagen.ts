/**
 * Een ESF-taak met versies op twee dagen, in één run.
 *
 * Op 17 november wordt de taak aangemaakt (open, hoeft niet door). Op 18 november wordt hij afgerond; de receiver start de Step Function en die
 * mislukt. De run controleert beide dagen. Er komt één geschiedenis met beide versies, en de taak als geheel is PROBLEM. Het OF-nummer komt uit
 * de trace van versie 2.
 */
import { RunScenario } from './RunScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';

const objectUuid = 'esf-taak-twee-dagen';
const executionArn = 'arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST10';

// Wat de object reader per dag teruggeeft.
const versionOf17November: ObjectVersion = {
  objectUuid,
  objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/esf-taak',
  objectTypeName: 'esfTaak',
  index: 1,
  registrationAt: '2026-11-17',
  esfStatus: 'open',
};
const versionOf18November: ObjectVersion = {
  objectUuid,
  objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/esf-taak',
  objectTypeName: 'esfTaak',
  index: 2,
  registrationAt: '2026-11-18',
  esfStatus: 'afgerond',
};

// Wat de log reader teruggeeft, van 17 november 00:00 tot de ochtendrun van 19 november (Amsterdam).
const logReaderResult: SubmissionLogUuidResult = {
  lookup: { objectUuid },
  queryRange: { fromInclusive: new Date('2026-11-16T23:00:00Z'), toExclusive: new Date('2026-11-19T06:00:00Z') },
  traces: [
    {
      correlation_id: 'afgerond',
      objectUuid,
      objectIndexes: [2],
      firstSeen: new Date('2026-11-18T09:00:00.000Z'),
      lastSeen: new Date('2026-11-18T09:00:00.500Z'),
      receiverEvents: [
        { timestamp: new Date('2026-11-18T09:00:00.000Z'), event: 'submission.notification.received', objectUuid },
        { timestamp: new Date('2026-11-18T09:00:00.100Z'), event: 'submission.object.fetch.started', objectUuid },
        { timestamp: new Date('2026-11-18T09:00:00.200Z'), event: 'submission.object.fetch.succeeded', objectUuid, objectIndex: 2 },
        {
          timestamp: new Date('2026-11-18T09:00:00.300Z'),
          event: 'submission.object.parsed',
          objectUuid,
          objectIndex: 2,
          reference: 'OF-TEST10',
          formName: 'Voorbeeldformulier',
        },
        { timestamp: new Date('2026-11-18T09:00:00.400Z'), event: 'submission.execution.starting', objectUuid, objectIndex: 2 },
        { timestamp: new Date('2026-11-18T09:00:00.500Z'), event: 'submission.execution.started', objectUuid, objectIndex: 2, execution_arn: executionArn },
      ],
      executions: [
        {
          execution_arn: executionArn,
          events: [
            { timestamp: new Date('2026-11-18T09:00:00.600Z'), type: 'ExecutionStarted', id: 1, redriveCount: 0 },
            { timestamp: new Date('2026-11-18T09:00:01.600Z'), type: 'ExecutionFailed', id: 2, redriveCount: 0 },
          ],
        },
      ],
    },
  ],
};

export const scenario: RunScenario = {
  description: 'een ESF-taak met versies op twee dagen krijgt één geschiedenis, en is PROBLEM als één versie misgaat',
  event: { firstDay: '2026-11-17', lastDay: '2026-11-18' },
  historiesBefore: [],
  objectReaderVersionsPerDay: { '2026-11-17': [versionOf17November], '2026-11-18': [versionOf18November] },
  objectsApiFails: false,
  logReaderResults: [logReaderResult],
  logReadFailsFor: [],
  remainingTimeInMillis: [600_000],
  expected: {
    report: {
      status: 'COMPLETE',
      days: [{ day: '2026-11-17', status: 'COMPLETE' }, { day: '2026-11-18', status: 'COMPLETE' }],
      totals: { esfTaak: { objects: 1, versions: 2, IGNORED: 1, PROBLEM: 1, esfStatus: { open: 1, afgerond: 1 } } },
      notOkObjectUuids: [objectUuid],
    },
    histories: [
      {
        objectUuid,
        reference: 'OF-TEST10',
        objectOutcome: 'PROBLEM',
        versions: [{ index: 1, outcome: 'IGNORED' }, { index: 2, outcome: 'PROBLEM', reason: 'EXECUTION_FAILED' }],
        firstProblemAt: expect.any(String),
      },
    ],
  },
};
