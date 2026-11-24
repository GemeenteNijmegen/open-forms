/**
 * Een gewone dag op productie, de voorbeelden uit report-text/README.md.
 *
 * De controle van 22 november is volledig. Er zijn afwijkingen van elke soort, en een inzending zonder OF-nummer en formulier. Versies van
 * eerdere dagen en versies die goed gingen staan wel in de geschiedenis, maar niet in het rapport. De ESF-taken staan alleen in het ESF-rapport.
 */
import { ReportScenario } from './ReportScenario';
import { SubmissionProcessingHistory } from '../../../store/SubmissionProcessingHistory';

const runId = 'run-22-november';
const checkedInRun = { firstCheckedAt: '2026-11-23T05:00:10.000Z', lastCheckedAt: '2026-11-23T05:00:10.000Z', runId };
const noTraces = { correlationIds: [], executionArns: [] };

// De geschiedenissen van notOkObjectUuids, zoals de Lambda ze uit de tabel haalt.
const notOkSubmissionHistories: SubmissionProcessingHistory[] = [
  {
    objectUuid: '3f6c2a9e-0b1d-4c55-9a37-2d8e5f1b7c40',
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
    objectTypeName: 'Submission',
    reference: 'OF-9DNFG3',
    formName: 'Bingo melden',
    objectOutcome: 'PROBLEM',
    versions: [{ index: 1, registrationAt: '2026-11-22', outcome: 'PROBLEM', reason: 'EXECUTION_FAILED', ...noTraces }],
    ...checkedInRun,
    firstProblemAt: '2026-11-23T05:00:10.000Z',
  },
  {
    // Versie 1 mislukte twee dagen eerder en hoort niet bij deze periode.
    objectUuid: '8c42b9e0-a351-46d8-b284-a30f0f4e8261',
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/vipjz',
    objectTypeName: 'VIPJZ',
    objectOutcome: 'PROBLEM',
    versions: [
      { index: 1, registrationAt: '2026-11-20', outcome: 'PROBLEM', reason: 'OBJECT_FETCH_FAILED', ...noTraces },
      { index: 2, registrationAt: '2026-11-22', outcome: 'PROBLEM', reason: 'OBJECT_FETCH_FAILED', ...noTraces },
    ],
    ...checkedInRun,
    firstProblemAt: '2026-11-21T05:00:10.000Z',
  },
  {
    objectUuid: '5a7196e2-0f42-4835-9db1-f126d987da36',
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/sociaal-domein',
    objectTypeName: 'SociaalDomein',
    reference: 'OF-8KDR21',
    formName: 'Aanvraag bijzondere bijstand',
    objectOutcome: 'IN_PROGRESS',
    versions: [{ index: 1, registrationAt: '2026-11-22', outcome: 'IN_PROGRESS', ...noTraces }],
    ...checkedInRun,
  },
  {
    objectUuid: '76d1a984-3a6f-479c-b328-e4f8123d0957',
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/submission',
    objectTypeName: 'Submission',
    reference: 'OF-4ABC82',
    formName: 'Evenement melden',
    objectOutcome: 'UNCERTAIN',
    versions: [{ index: 1, registrationAt: '2026-11-22', outcome: 'UNCERTAIN', reason: 'EXECUTION_EVENTS_NOT_FOUND', ...noTraces }],
    ...checkedInRun,
  },
  {
    objectUuid: 'b21a70e6-92c8-4bb8-96c7-e93571d2a482',
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/tribe-verzoek',
    objectTypeName: 'TribeVerzoek',
    objectOutcome: 'UNCERTAIN',
    versions: [
      { index: 1, registrationAt: '2026-11-15', outcome: 'PROCESSED', ...noTraces },
      { index: 2, registrationAt: '2026-11-22', outcome: 'UNCERTAIN', reason: 'TRACE_FITS_MULTIPLE_VERSIONS', ...noTraces },
    ],
    ...checkedInRun,
  },
  {
    objectUuid: 'c819e640-b712-475f-9c3a-a142e850ea73',
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/vipjz',
    objectTypeName: 'VIPJZ',
    reference: 'OF-6XYZ34',
    formName: 'Vergunningaanvraag',
    objectOutcome: 'PROCESSED_AFTER_REDRIVE',
    versions: [{ index: 1, registrationAt: '2026-11-22', outcome: 'PROCESSED_AFTER_REDRIVE', ...noTraces }],
    ...checkedInRun,
  },
  {
    // Versie 2 is open en dus terecht genegeerd; alleen de afgeronde versie 3 staat in het rapport.
    objectUuid: '7d58f80c-6d17-41c0-8b85-fd00418ea821',
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/esf-taak',
    objectTypeName: 'esfTaak',
    reference: 'OF-7ABC12',
    objectOutcome: 'PROBLEM',
    versions: [
      { index: 1, registrationAt: '2026-11-21', esfStatus: 'open', outcome: 'IGNORED', ...noTraces },
      { index: 2, registrationAt: '2026-11-22', esfStatus: 'open', outcome: 'IGNORED', ...noTraces },
      { index: 3, registrationAt: '2026-11-22', esfStatus: 'afgerond', outcome: 'PROBLEM', reason: 'EXECUTION_FAILED', ...noTraces },
    ],
    ...checkedInRun,
    firstProblemAt: '2026-11-23T05:00:10.000Z',
  },
  {
    objectUuid: '91f719f6-0c6f-4b19-bad6-bc5d6959e532',
    objectType: 'https://objecttypes.example.nl/api/v2/objecttypes/esf-taak',
    objectTypeName: 'esfTaak',
    objectOutcome: 'PROBLEM',
    versions: [
      { index: 1, registrationAt: '2026-11-21', esfStatus: 'open', outcome: 'IGNORED', ...noTraces },
      { index: 2, registrationAt: '2026-11-22', esfStatus: 'afgerond', outcome: 'PROBLEM', reason: 'EXECUTION_START_FAILED', ...noTraces },
    ],
    ...checkedInRun,
    firstProblemAt: '2026-11-23T05:00:10.000Z',
  },
];

export const scenario: ReportScenario = {
  description: 'een gewone dag geeft de rapporten uit de README',
  input: {
    report: {
      runId,
      firstDay: '2026-11-22',
      lastDay: '2026-11-22',
      status: 'COMPLETE',
      startedAt: '2026-11-23T05:00:00.000Z',
      finishedAt: '2026-11-23T05:00:10.000Z',
      days: [{ day: '2026-11-22', status: 'COMPLETE' }],
      totals: {
        SociaalDomein: { objects: 35, versions: 35, PROCESSED: 34, IN_PROGRESS: 1 },
        Submission: { objects: 180, versions: 185, PROCESSED: 176, IGNORED: 7, PROBLEM: 1, UNCERTAIN: 1 },
        TribeVerzoek: { objects: 45, versions: 45, PROCESSED: 44, UNCERTAIN: 1 },
        VIPJZ: { objects: 30, versions: 30, PROCESSED: 28, PROCESSED_AFTER_REDRIVE: 1, PROBLEM: 1 },
        esfTaak: {
          objects: 26,
          versions: 33,
          PROCESSED: 6,
          IGNORED: 25,
          PROBLEM: 2,
          esfStatus: { open: 20, afgerond: 8, verwerkt: 4, gesloten: 1 },
        },
      },
      notOkObjectUuids: notOkSubmissionHistories.map((history) => history.objectUuid),
    },
    notOkSubmissionHistories,
    environment: 'Productie',
  },
  expected: {
    submissionReport: {
      subject: 'Open Forms - Dagrapport 22-11-2026 - Productie',
      body: `OPEN FORMS - DAGOVERZICHT

Datum: 22 november 2026
Omgeving: Productie
Controle: Volledig uitgevoerd

Unieke inzendingen: 290
Geregistreerde objectversies: 295

- Succesvol verwerkt: 282
- Succesvol na redrive: 1
- Bewust niet verwerkt: 7
- Mislukt: 2
- Nog in verwerking: 1
- Onzeker: 2

INZENDINGEN PER OBJECTTYPE

SociaalDomein: 35 inzendingen, 35 versies
Submission: 180 inzendingen, 185 versies
TribeVerzoek: 45 inzendingen, 45 versies
VIPJZ: 30 inzendingen, 30 versies


--------------------------------------------------
PROBLEMEN (2)
--------------------------------------------------

EXECUTION_FAILED: 1, OBJECT_FETCH_FAILED: 1

1. EXECUTION_FAILED

   Datum: 22 november 2026
   Objecttype: Submission
   Formulier: Bingo melden
   OF-nummer: OF-9DNFG3
   Object-UUID: 3f6c2a9e-0b1d-4c55-9a37-2d8e5f1b7c40
   Versie: 1


2. OBJECT_FETCH_FAILED

   Datum: 22 november 2026
   Objecttype: VIPJZ
   Formulier: Onbekend
   OF-nummer: Onbekend
   Object-UUID: 8c42b9e0-a351-46d8-b284-a30f0f4e8261
   Versie: 2


--------------------------------------------------
NOG IN VERWERKING (1)
--------------------------------------------------

IN_PROGRESS: 1

1. IN_PROGRESS

   Datum: 22 november 2026
   Objecttype: SociaalDomein
   Formulier: Aanvraag bijzondere bijstand
   OF-nummer: OF-8KDR21
   Object-UUID: 5a7196e2-0f42-4835-9db1-f126d987da36
   Versie: 1


--------------------------------------------------
ONZEKER (2)
--------------------------------------------------

EXECUTION_EVENTS_NOT_FOUND: 1, TRACE_FITS_MULTIPLE_VERSIONS: 1

1. EXECUTION_EVENTS_NOT_FOUND

   Datum: 22 november 2026
   Objecttype: Submission
   Formulier: Evenement melden
   OF-nummer: OF-4ABC82
   Object-UUID: 76d1a984-3a6f-479c-b328-e4f8123d0957
   Versie: 1


2. TRACE_FITS_MULTIPLE_VERSIONS

   Datum: 22 november 2026
   Objecttype: TribeVerzoek
   Formulier: Onbekend
   OF-nummer: Onbekend
   Object-UUID: b21a70e6-92c8-4bb8-96c7-e93571d2a482
   Versie: 2


--------------------------------------------------
SUCCESVOL NA REDRIVE (1)
--------------------------------------------------

PROCESSED_AFTER_REDRIVE: 1

1. PROCESSED_AFTER_REDRIVE

   Datum: 22 november 2026
   Objecttype: VIPJZ
   Formulier: Vergunningaanvraag
   OF-nummer: OF-6XYZ34
   Object-UUID: c819e640-b712-475f-9c3a-a142e850ea73
   Versie: 1


--------------------------------------------------
TOELICHTING
--------------------------------------------------

De aantallen betreffen objectversies die in de gecontroleerde periode zijn geregistreerd. Eén inzending kan meerdere versies hebben.

Dit rapport bevat geen ESF-taken. Hiervoor wordt een afzonderlijk rapport opgesteld.

--------------------------------------------------
Automatisch gegenereerd door Open Forms Monitoring.`,
    },
    esfReport: {
      subject: 'ESF - Dagrapport 22-11-2026 - Productie',
      body: `ESF - DAGOVERZICHT

Datum: 22 november 2026
Omgeving: Productie
Controle: Volledig uitgevoerd

Unieke ESF-taken: 26
Geregistreerde objectversies: 33

ESF-STATUSSEN

- Open: 20
- Afgerond: 8
- Verwerkt: 4
- Gesloten: 1

AFLEVERING AAN ESB (STATUS 'AFGEROND')

- Succesvol afgeleverd: 6
- Aflevering mislukt: 2
- Nog in verwerking: 0
- Onzeker: 0


--------------------------------------------------
PROBLEMEN (2)
--------------------------------------------------

EXECUTION_FAILED: 1, EXECUTION_START_FAILED: 1

1. EXECUTION_FAILED

   Datum: 22 november 2026
   OF-nummer: OF-7ABC12
   Object-UUID: 7d58f80c-6d17-41c0-8b85-fd00418ea821
   Versie: 3
   ESF-status: afgerond


2. EXECUTION_START_FAILED

   Datum: 22 november 2026
   OF-nummer: Onbekend
   Object-UUID: 91f719f6-0c6f-4b19-bad6-bc5d6959e532
   Versie: 2
   ESF-status: afgerond


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
