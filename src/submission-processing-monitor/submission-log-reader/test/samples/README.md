Samples voor de scenario-tests in deze module.

Echte CloudWatch Logs Insights-exports uit accp, niet gefabriceerd. Elk JSON-bestand is een array van CWLI query result-rows precies zoals CloudWatchLogsQueryRunner ze teruggeeft: platte string-waardes, ook getallen.

Receiver-samples bevatten alleen de velden die de receiver-query zelf selecteert. De onderliggende DEBUG-regel met het volledige object (met BSN, e-mailadres, naam) staat er nooit in, alleen de losse structured-logging-velden, die geen persoonsgegevens bevatten. Orchestrator-samples zijn Step Functions' eigen executiehistorie, sowieso geen persoonsgegevens.

- receiver/happy-flow.json: één volledige succesvolle trace, van notification ontvangen tot execution started.
- orchestrator/succeeded.json: de volledige executiehistorie (25 events) voor diezelfde submission, zelfde objectUuid en execution_arn.

Nog niet toegevoegd: fetch-failure vóór index, een ARN zonder execution-events, een gevangen fout. Daar was geen echte export met een falende executie voor beschikbaar. Die scenario's staan al wel als losse testfixtures in SubmissionTraceBuilder.test.ts, niet als sample-bestand.
