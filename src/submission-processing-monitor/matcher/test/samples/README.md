# Matcher-scenario's

Elk bestand is één scenario en werkt ook als voorbeeld. Bovenaan staat in gewone woorden wat er gebeurt. Daaronder staat wat de object reader
teruggeeft (objectReaderVersions), wat de log reader teruggeeft (logReaderResult), en in scenario de verwachte uitkomst van findOutcomes.
../SubmissionProcessingMatcher.test.ts voert ze allemaal uit; een nieuw bestand krijgt daar een import.

Alle data is verzonnen, behalve echte-inzending-geslaagd.ts: die gebruikt de echte accp-export uit de samples van de log reader.

| Bestand | Uitkomst |
|---|---|
| echte-inzending-geslaagd.ts | PROCESSED |
| esf-taak-open-afgerond-verwerkt.ts | IGNORED, PROCESSED, IGNORED |
| esf-taak-onbekende-status.ts | UNCERTAIN, UNKNOWN_ESF_STATUS |
| step-function-mislukt.ts | PROBLEM, EXECUTION_FAILED |
| step-function-geslaagd-na-redrive.ts | PROCESSED_AFTER_REDRIVE |
| step-function-loopt-nog.ts | IN_PROGRESS |
| nieuwe-poging-na-mislukte-start.ts | PROCESSED, met beide pogingen |
| geen-notificatie.ts | PROBLEM, NO_NOTIFICATION |
| tijdvak-te-kort.ts | UNCERTAIN, LOGS_TIME_RANGE_TOO_SHORT |
| ophalen-mislukt-een-versie.ts | PROBLEM, OBJECT_FETCH_FAILED |
| ophalen-mislukt-twee-versies.ts | PROCESSED en UNCERTAIN, TRACE_FITS_MULTIPLE_VERSIONS |
| trace-van-latere-versie.ts | PROCESSED, en een trace in tracesWithoutVersion |
| logs-niet-gelezen.ts | UNCERTAIN, LOGS_NOT_READ |
| onzekere-poging-daarna-mislukt.ts | UNCERTAIN, EXECUTION_EVENTS_NOT_FOUND, met beide pogingen |
| gestart-zonder-execution-arn.ts | UNCERTAIN, EXECUTION_EVENTS_NOT_FOUND |
