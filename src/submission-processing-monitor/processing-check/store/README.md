# Store

ProcessingCheckResultsRepository leest en schrijft de resultaten van de processing check: per inzending de geschiedenis en per run een
rapport. Hij weet niets van uitkomsten; wat er in de geschiedenis komt, bepaalt [historyAfterCheckingDay](../historyAfterCheckingDay.ts).
De tabel zelf maakt de CDK in [ProcessingCheckResultsTable](../../infrastructure/ProcessingCheckResultsTable.ts).

```ts
import { ProcessingCheckResultsRepository } from './store/ProcessingCheckResultsRepository';

const resultsRepository = new ProcessingCheckResultsRepository({ tableName: process.env.TABLE_NAME! });
const existingHistory = await resultsRepository.getSubmissionHistory(objectUuid);
const notOkSubmissionHistories = await resultsRepository.getSubmissionHistories(report.notOkObjectUuids);
await resultsRepository.putSubmissionHistory(history);
await resultsRepository.putReport(report);
```

In een test mock je DynamoDB met aws-sdk-client-mock; dan test je de sleutels en de ttl van de repository mee.

## Wat er in de tabel staat

Eén tabel met twee soorten items. De geschiedenis van een inzending (SubmissionProcessingHistory.ts) heeft PK OBJECT#objectUuid en SK
OBJECT, een rapport PK RUN en SK startedAt#runId. Zo geeft één Query op PK RUN de runs op volgorde van starttijd. Items verlopen na drie jaar
via ttl; die zet de repository, de rest van de code kent hem niet. Er staan geen persoonsgegevens, formulierdata of logregels in. Met de
correlation-id's en execution-arn's zoek je verder in CloudWatch, zolang die logs bestaan (6 maanden).

De geschiedenis van een inzending:

```json
{
  "PK": "OBJECT#3f6c2a9e-0b1d-4c55-9a37-2d8e5f1b7c40",
  "SK": "OBJECT",
  "objectUuid": "3f6c2a9e-0b1d-4c55-9a37-2d8e5f1b7c40",
  "objectTypeName": "esfTaak",
  "reference": "OF-TEST01",
  "formName": "Voorbeeldformulier",
  "objectOutcome": "PROBLEM",
  "versions": [
    { "index": 1, "registrationAt": "2026-11-18", "esfStatus": "open", "outcome": "IGNORED" },
    {
      "index": 2, "registrationAt": "2026-11-18", "esfStatus": "afgerond", "outcome": "PROBLEM", "reason": "EXECUTION_FAILED",
      "correlationIds": ["..."], "executionArns": ["arn:aws:states:...:execution:orchestrator:..."]
    }
  ],
  "firstCheckedAt": "2026-11-19T06:00:12Z",
  "lastCheckedAt": "2026-11-19T06:00:12Z",
  "firstProblemAt": "2026-11-19T06:00:12Z",
  "runId": "..."
}
```

objectOutcome is de slechtste uitkomst van de versies. Een nieuwe controle van een dag vervangt alleen de versies van die dag. reference en
formName komen uit de receiver-logs en ontbreken als het Object niet opgehaald kon worden. firstCheckedAt en firstProblemAt blijven staan,
lastCheckedAt en runId zijn van de laatste controle. resolvedAt komt erbij als een object met een probleem later goed is, en gaat weer weg als
het opnieuw misgaat.

Een rapport:

```json
{
  "PK": "RUN",
  "SK": "2026-11-19T06:00:00Z#...",
  "runId": "...",
  "firstDay": "2026-11-18",
  "lastDay": "2026-11-18",
  "status": "COMPLETE",
  "startedAt": "2026-11-19T06:00:00Z",
  "finishedAt": "2026-11-19T06:07:41Z",
  "days": [{ "day": "2026-11-18", "status": "COMPLETE" }],
  "totals": {
    "submission": { "objects": 290, "versions": 290, "PROCESSED": 286, "PROBLEM": 2, "UNCERTAIN": 2 },
    "esfTaak": { "objects": 138, "versions": 156, "IGNORED": 30, "PROCESSED": 123, "PROBLEM": 3, "esfStatus": { "open": 12, "afgerond": 126, "verwerkt": 18 } }
  },
  "notOkObjectUuids": ["3f6c2a9e-0b1d-4c55-9a37-2d8e5f1b7c40", "..."],
  "cost": { "queries": 712, "gbScanned": 44.901, "estimatedCostUsd": 0.2829, "durationMs": 461700 }
}
```

De totalen tellen inzendingen en versies per objecttype, bij esfTaak ook de versies per status. notOkObjectUuids zijn de inzendingen met een
versie in de periode die niet PROCESSED of IGNORED is; hun geschiedenis geeft de details en de laatste stand. cost staat er alleen in met
diagnostics aan: estimatedCostUsd is gbScanned maal de prijs per GB voor Logs Insights die in report/countRunCost.ts staat.
