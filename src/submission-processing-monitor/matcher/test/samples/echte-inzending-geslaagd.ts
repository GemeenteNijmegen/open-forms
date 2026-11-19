/**
 * Een echte inzending uit accp, goed verwerkt.
 *
 * De logs zijn de echte CloudWatch-export die ook de tests van de log reader gebruiken (receiver/happy-flow.json en orchestrator/succeeded.json):
 * de notificatie komt binnen, het Object wordt opgehaald en geparst, de Step Function start en eindigt na 25 events met ExecutionSucceeded. De
 * versie moest verwerkt worden en is dus PROCESSED.
 */
import { MatcherScenario } from './MatcherScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';
import { SubmissionLogUuidResult } from '../../../submission-log-reader/SubmissionLogReaderTypes';
import orchestratorSucceeded from '../../../submission-log-reader/test/samples/orchestrator/succeeded.json';
import receiverHappyFlow from '../../../submission-log-reader/test/samples/receiver/happy-flow.json';
import { attachExecutions, buildReceiverTraces } from '../../../submission-log-reader/traces/SubmissionTraceBuilder';

const objectUuid = '37119935-86ce-4fdf-8f4d-cddf9f232068';

// Wat de object reader teruggeeft: new ObjectReader().findVersions({ firstDay: '2026-11-02', lastDay: '2026-11-02' })
const objectReaderVersions: ObjectVersion[] = [
  {
    objectUuid,
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
    objectTypeName: 'submission',
    index: 1,
    registrationAt: '2026-11-02',
  },
];

// Wat de log reader teruggeeft: new CloudWatchSubmissionLogReader().findByObjectUuid({ objectUuid, range }),
// met range van 2 november 00:00 tot 3 november 07:00 (Amsterdam). De traces bouwt de log reader zelf uit de echte CloudWatch-rijen.
const receiverTraces = buildReceiverTraces(receiverHappyFlow as Record<string, string>[], objectUuid, 'receiver-query');
const logReaderResult: SubmissionLogUuidResult = {
  lookup: { objectUuid },
  queryRange: { fromInclusive: new Date('2026-11-01T23:00:00Z'), toExclusive: new Date('2026-11-03T06:00:00Z') },
  traces: attachExecutions(receiverTraces, orchestratorSucceeded as Record<string, string>[], 'orchestrator-query'),
};

export const scenario: MatcherScenario = {
  description: 'een echte inzending uit accp met een geslaagde Step Function is goed verwerkt',
  input: {
    versions: objectReaderVersions,
    logs: [logReaderResult],
    objectUuidsWithUnreadLogs: [],
  },
  expected: {
    versions: [
      { version: { objectUuid, index: 1 }, outcome: 'PROCESSED', traces: [{ correlation_id: logReaderResult.traces[0].correlation_id }] },
    ],
    tracesWithoutVersion: [],
  },
};
