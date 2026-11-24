/**
 * Een handmatige run over drie dagen, waarvan twee niet volledig gecontroleerd zijn.
 *
 * Op 2 november konden logs niet gelezen worden, op 3 november was de tijd op. Beide rapporten beginnen met de waarschuwing en de dagen met de
 * reden. Eén inzending heeft op 1 en 2 november een versie: hij telt één keer als unieke inzending en staat met beide versies in het rapport,
 * op datum. Er waren geen ESF-taken, dus het ESF-rapport heeft nullen.
 */
import { ReportScenario } from './ReportScenario';
import { SubmissionProcessingHistory } from '../../../store/SubmissionProcessingHistory';

const runId = 'run-1-tot-en-met-3-november';

const notOkSubmissionHistories: SubmissionProcessingHistory[] = [
  {
    objectUuid: 'e5b0c1d2-4f6a-4b8c-9d0e-1f2a3b4c5d6e',
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
    objectTypeName: 'Submission',
    reference: 'OF-2KLM45',
    formName: 'Bingo melden',
    objectOutcome: 'PROBLEM',
    versions: [
      { index: 1, registrationAt: '2026-11-01', outcome: 'PROBLEM', reason: 'EXECUTION_TIMED_OUT', correlationIds: [], executionArns: [] },
      { index: 2, registrationAt: '2026-11-02', outcome: 'UNCERTAIN', reason: 'LOGS_NOT_READ', correlationIds: [], executionArns: [] },
    ],
    firstCheckedAt: '2026-11-23T09:00:05.000Z',
    lastCheckedAt: '2026-11-23T09:00:08.000Z',
    runId,
    firstProblemAt: '2026-11-23T09:00:05.000Z',
  },
];

export const scenario: ReportScenario = {
  description: 'een run over meer dagen met onvolledige dagen geeft de totalen van de periode en de waarschuwing',
  input: {
    report: {
      runId,
      firstDay: '2026-11-01',
      lastDay: '2026-11-03',
      status: 'INCOMPLETE',
      startedAt: '2026-11-23T09:00:00.000Z',
      finishedAt: '2026-11-23T09:14:00.000Z',
      days: [
        { day: '2026-11-01', status: 'COMPLETE' },
        { day: '2026-11-02', status: 'INCOMPLETE', reason: 'LOGS_NOT_READ' },
        { day: '2026-11-03', status: 'INCOMPLETE', reason: 'OUT_OF_TIME' },
      ],
      totals: { Submission: { objects: 3, versions: 4, PROCESSED: 2, PROBLEM: 1, UNCERTAIN: 1 } },
      notOkObjectUuids: notOkSubmissionHistories.map((history) => history.objectUuid),
    },
    notOkSubmissionHistories,
    environment: 'Acceptatie',
  },
  expected: {
    submissionReport: {
      subject: 'Open Forms - Rapport 01-11-2026 t/m 03-11-2026 - Acceptatie',
      body: `LET OP: CONTROLE ONVOLLEDIG

Niet alle inzendingen konden worden gecontroleerd.
De onderstaande aantallen betreffen uitsluitend de beschikbare resultaten en kunnen onvolledig zijn.

2 november 2026: LOGS_NOT_READ
3 november 2026: OUT_OF_TIME

OPEN FORMS - OVERZICHT

Periode: 1 november 2026 t/m 3 november 2026
Omgeving: Acceptatie
Controle: Onvolledig

Unieke inzendingen: 3
Geregistreerde objectversies: 4

- Succesvol verwerkt: 2
- Succesvol na redrive: 0
- Bewust niet verwerkt: 0
- Mislukt: 1
- Nog in verwerking: 0
- Onzeker: 1

INZENDINGEN PER OBJECTTYPE

Submission: 3 inzendingen, 4 versies


--------------------------------------------------
PROBLEMEN (1)
--------------------------------------------------

EXECUTION_TIMED_OUT: 1

1. EXECUTION_TIMED_OUT

   Datum: 1 november 2026
   Objecttype: Submission
   Formulier: Bingo melden
   OF-nummer: OF-2KLM45
   Object-UUID: e5b0c1d2-4f6a-4b8c-9d0e-1f2a3b4c5d6e
   Versie: 1


--------------------------------------------------
ONZEKER (1)
--------------------------------------------------

LOGS_NOT_READ: 1

1. LOGS_NOT_READ

   Datum: 2 november 2026
   Objecttype: Submission
   Formulier: Bingo melden
   OF-nummer: OF-2KLM45
   Object-UUID: e5b0c1d2-4f6a-4b8c-9d0e-1f2a3b4c5d6e
   Versie: 2


--------------------------------------------------
TOELICHTING
--------------------------------------------------

De aantallen betreffen objectversies die in de gecontroleerde periode zijn geregistreerd. Eén inzending kan meerdere versies hebben.

Dit rapport bevat geen ESF-taken. Hiervoor wordt een afzonderlijk rapport opgesteld.

--------------------------------------------------
Automatisch gegenereerd door Open Forms Monitoring.`,
    },
    esfReport: {
      subject: 'ESF - Rapport 01-11-2026 t/m 03-11-2026 - Acceptatie',
      body: `LET OP: CONTROLE ONVOLLEDIG

Niet alle inzendingen konden worden gecontroleerd.
De onderstaande aantallen betreffen uitsluitend de beschikbare resultaten en kunnen onvolledig zijn.

2 november 2026: LOGS_NOT_READ
3 november 2026: OUT_OF_TIME

ESF - OVERZICHT

Periode: 1 november 2026 t/m 3 november 2026
Omgeving: Acceptatie
Controle: Onvolledig

Unieke ESF-taken: 0
Geregistreerde objectversies: 0

ESF-STATUSSEN

- Open: 0
- Afgerond: 0
- Verwerkt: 0
- Gesloten: 0

AFLEVERING AAN ESB (STATUS 'AFGEROND')

- Succesvol afgeleverd: 0
- Aflevering mislukt: 0
- Nog in verwerking: 0
- Onzeker: 0


--------------------------------------------------
TOELICHTING
--------------------------------------------------

De belangrijkste controle betreft ESF-taken met de status 'afgerond'.

Alleen ESF-taken met status 'afgerond' moeten via AWS Step Functions worden afgeleverd aan de ESB-queue.

De statussen 'open', 'verwerkt' en 'gesloten' worden niet doorgestuurd naar de ESB.

Een succesvolle Step Functions-execution betekent dat het bericht aan de ESB-queue is afgeleverd.
Dit betekent niet dat het bericht vervolgens inhoudelijk door ESB is verwerkt.

De ESF-statusaantallen betreffen geregistreerde objectversies in de gecontroleerde periode, niet noodzakelijk nieuw aangemaakte ESF-taken.

--------------------------------------------------
Automatisch gegenereerd door Open Forms Monitoring.`,
    },
  },
};
