/**
 * De logs van een ESF-taak konden niet gelezen worden.
 *
 * Versie 1 is open en hoeft niet door de forwarder: die is IGNORED, daar zijn geen logs voor nodig. Alleen de afgeronde versie 2 hangt af
 * van de logs en is daarom UNCERTAIN met LOGS_NOT_READ. Zo telt een open versie niet als onzekere aflevering aan de ESB.
 */
import { MatcherScenario } from './MatcherScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';

const objectUuid = 'esf-taak-logs-niet-gelezen';

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
];

// De log reader gooide voor dit Object een CloudWatchSubmissionLogReaderError; de aanroeper zet de uuid in objectUuidsWithUnreadLogs.

export const scenario: MatcherScenario = {
  description: 'als de logs van een ESF-taak niet gelezen konden worden, blijft een open versie genegeerd en is alleen de afgeronde onzeker',
  input: {
    versions: objectReaderVersions,
    logs: [],
    objectUuidsWithUnreadLogs: [objectUuid],
  },
  expected: {
    versions: [
      { version: { objectUuid, index: 1 }, outcome: 'IGNORED', traces: [] },
      { version: { objectUuid, index: 2 }, outcome: 'UNCERTAIN', reason: 'LOGS_NOT_READ', traces: [] },
    ],
    tracesWithoutVersion: [],
  },
};
