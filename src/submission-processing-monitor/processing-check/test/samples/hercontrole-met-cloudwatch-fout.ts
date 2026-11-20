/**
 * Een hercontrole waarbij CloudWatch een fout geeft, van een inzending die al opgelost was.
 *
 * Een eerdere run vond na een redrive PROCESSED_AFTER_REDRIVE en zette resolvedAt. Bij de hercontrole van dezelfde dag gooit de log reader. Dat
 * zegt niets nieuws over de inzending, dus de geschiedenis blijft zoals hij was: de oude uitkomst en resolvedAt blijven staan. Het rapport van
 * deze run laat wel zien dat de logs niet gelezen konden worden.
 */
import { RunScenario } from './RunScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionProcessingHistory } from '../../store/SubmissionProcessingHistory';

const objectUuid = 'inzending-al-opgelost';

// Wat een eerdere run opsloeg.
const historyBefore: SubmissionProcessingHistory = {
  objectUuid,
  objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
  objectTypeName: 'submission',
  reference: 'OF-TEST15',
  objectOutcome: 'PROCESSED_AFTER_REDRIVE',
  versions: [
    {
      index: 1,
      registrationAt: '2026-11-18',
      outcome: 'PROCESSED_AFTER_REDRIVE',
      correlationIds: ['notificatie'],
      executionArns: ['arn:aws:states:eu-central-1:000000000000:execution:orchestrator:OF-TEST15'],
    },
  ],
  firstCheckedAt: '2026-11-19T06:00:12.000Z',
  lastCheckedAt: '2026-11-20T06:00:12.000Z',
  runId: 'eerdere-run',
  firstProblemAt: '2026-11-19T06:00:12.000Z',
  resolvedAt: '2026-11-20T06:00:12.000Z',
};

// Wat de object reader teruggeeft voor 18 november. De log reader gooit voor deze inzending.
const version: ObjectVersion = {
  objectUuid,
  objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
  objectTypeName: 'submission',
  index: 1,
  registrationAt: '2026-11-18',
};

export const scenario: RunScenario = {
  description: 'een CloudWatch-fout bij een hercontrole laat de bekende uitkomst en resolvedAt staan',
  event: { firstDay: '2026-11-18', lastDay: '2026-11-18' },
  historiesBefore: [historyBefore],
  objectReaderVersionsPerDay: { '2026-11-18': [version] },
  objectsApiFails: false,
  logReaderResults: [],
  logReadFailsFor: [objectUuid],
  remainingTimeInMillis: [600_000],
  expected: {
    report: {
      status: 'INCOMPLETE',
      days: [{ day: '2026-11-18', status: 'INCOMPLETE', reason: 'LOGS_NOT_READ' }],
      totals: { submission: { objects: 1, versions: 1, UNCERTAIN: 1 } },
      notOkObjectUuids: [objectUuid],
    },
    histories: [
      {
        objectUuid,
        reference: 'OF-TEST15',
        objectOutcome: 'PROCESSED_AFTER_REDRIVE',
        versions: [{ index: 1, outcome: 'PROCESSED_AFTER_REDRIVE' }],
        firstProblemAt: '2026-11-19T06:00:12.000Z',
        resolvedAt: '2026-11-20T06:00:12.000Z',
      },
    ],
  },
};
