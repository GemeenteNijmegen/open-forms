/**
 * De Objects API faalde, dus er is niets gecontroleerd.
 *
 * Een rapport met nullen zou eruitzien als een dag zonder inzendingen. Daarom bevatten beide rapporten alleen de waarschuwing.
 */
import { ReportScenario } from './ReportScenario';

export const scenario: ReportScenario = {
  description: 'als de Objects API faalt, staat in beide rapporten alleen de waarschuwing',
  input: {
    report: {
      runId: 'run-objects-api-fout',
      firstDay: '2026-11-22',
      lastDay: '2026-11-22',
      status: 'INCOMPLETE',
      startedAt: '2026-11-23T05:00:00.000Z',
      finishedAt: '2026-11-23T05:00:02.000Z',
      days: [{ day: '2026-11-22', status: 'INCOMPLETE', reason: 'OBJECTS_API_FAILED' }],
      totals: {},
      notOkObjectUuids: [],
    },
    notOkSubmissionHistories: [],
    environment: 'Productie',
  },
  expected: {
    submissionReport: {
      subject: 'Open Forms - Dagrapport 22-11-2026 - Productie',
      body: `LET OP: CONTROLE ONVOLLEDIG

Niet alle inzendingen konden worden gecontroleerd.
De onderstaande aantallen betreffen uitsluitend de beschikbare resultaten en kunnen onvolledig zijn.

22 november 2026: OBJECTS_API_FAILED

OPEN FORMS - DAGOVERZICHT

Datum: 22 november 2026
Omgeving: Productie
Controle: Onvolledig


--------------------------------------------------
Automatisch gegenereerd door Open Forms Monitoring.`,
    },
    esfReport: {
      subject: 'ESF - Dagrapport 22-11-2026 - Productie',
      body: `LET OP: CONTROLE ONVOLLEDIG

Niet alle inzendingen konden worden gecontroleerd.
De onderstaande aantallen betreffen uitsluitend de beschikbare resultaten en kunnen onvolledig zijn.

22 november 2026: OBJECTS_API_FAILED

ESF - DAGOVERZICHT

Datum: 22 november 2026
Omgeving: Productie
Controle: Onvolledig


--------------------------------------------------
Automatisch gegenereerd door Open Forms Monitoring.`,
    },
  },
};
