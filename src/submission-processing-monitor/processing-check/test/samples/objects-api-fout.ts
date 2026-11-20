/**
 * De Objects API geeft een fout.
 *
 * De run controleert 18 en 19 november en haalt de versies van die twee dagen in één keer op. De object reader gooit. Beide dagen worden
 * INCOMPLETE met OBJECTS_API_FAILED en er wordt niets opgeslagen, ook geen lege telling. Er worden ook geen logs gelezen.
 */
import { RunScenario } from './RunScenario';

export const scenario: RunScenario = {
  description: 'een fout van de Objects API maakt alle dagen INCOMPLETE en slaat niets op',
  event: { firstDay: '2026-11-18', lastDay: '2026-11-19' },
  historiesBefore: [],
  objectReaderVersionsPerDay: {},
  objectsApiFails: true,
  logReaderResults: [],
  logReadFailsFor: [],
  remainingTimeInMillis: [600_000],
  expected: {
    report: {
      status: 'INCOMPLETE',
      days: [
        { day: '2026-11-18', status: 'INCOMPLETE', reason: 'OBJECTS_API_FAILED' },
        { day: '2026-11-19', status: 'INCOMPLETE', reason: 'OBJECTS_API_FAILED' },
      ],
      totals: {},
      notOkObjectUuids: [],
    },
    histories: [],
  },
};
