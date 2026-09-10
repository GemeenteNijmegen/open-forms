# Monitoring en logging

Afspraken en opzet voor het volgen van submission-verwerking staan niet hier, maar bij de code zelf:

- [`src/shared/submission-logging/README.md`](../src/shared/submission-logging/README.md) — de gedeelde loggingafspraken (Log Group tags, events, veldnamen) die de submission-forwarder en de submission-processing-monitor samen gebruiken.
- [`src/submission-processing-monitor/README.md`](../src/submission-processing-monitor/README.md) — doel en opbouw van de submission-processing-monitor zelf.


## Submission Processing Monitor

Gebruikt de logs en data uit api calls naar de objects api om te monitoren. On demand en scheduled.

- [`/src/submission-processing-monitor/submission-log-reader/README.md`](../src/submission-processing-monitor/submission-log-reader/README.md) - Cloudwatch Submission Log Reader haalt alle logs op, maar trekt nog geen conclusies.
