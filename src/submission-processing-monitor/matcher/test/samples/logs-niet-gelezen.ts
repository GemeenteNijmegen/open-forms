/**
 * De log reader gooide een fout voor dit Object.
 *
 * De aanroeper zet de objectUuid dan in objectUuidsWithUnreadLogs. Zonder logs is er niets te concluderen: UNCERTAIN met LOGS_NOT_READ, ook al
 * zou er misschien gewoon een geslaagde verwerking in de logs staan.
 */
import { MatcherScenario } from './MatcherScenario';
import { ObjectVersion } from '../../../object-reader/ObjectReader';

const objectUuid = 'inzending-logs-niet-gelezen';

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

// De log reader gooide voor dit Object een CloudWatchSubmissionLogReaderError. Er is dus geen resultaat; de aanroeper zet de uuid in
// objectUuidsWithUnreadLogs.

export const scenario: MatcherScenario = {
  description: 'als de logs van een Object niet gelezen konden worden, zijn al zijn versies onzeker',
  input: {
    versions: objectReaderVersions,
    logs: [],
    objectUuidsWithUnreadLogs: [objectUuid],
  },
  expected: {
    versions: [
      { version: { objectUuid, index: 1 }, outcome: 'UNCERTAIN', reason: 'LOGS_NOT_READ', traces: [] },
    ],
    tracesWithoutVersion: [],
  },
};
