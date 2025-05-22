# ESF flows en data-formats:

We onderscheiden 3 processen in het ESF:
1. Klaarzetten nieuwe taken
2. Indienen formulier
3. Verwerken formulier in suite + corsa

## 1. Klaarzetten nieuwe taken
Maandelijks wordt een lijst uitgedraaid van deelnemers aan het elektronisch statusformulier. Op dit moment wordt de uitkering ook geblokkeerd.
Deze wordt voor de ESB klaargezet in CSV-format. 
Dit bestand bevat:
- BSN
- Dossiernr
- Periodenr
- E-mail
- Telefoonnummer (optioneel?)

Op basis van deze lijst worden taken klaargezet. Taken zijn technisch `objecten` in de `[object-api](https://mijn-services.nijmegen.nl/objects/api/v2/schema/)`.
De objecten bevatten alle relevante informatie.

```mermaid
sequenceDiagram
    participant Suite
    participant ESB
    participant Objects API
    participant NotifyNL

    Suite->>ESB: Genereert CSV-bestand (BSN, Dossiernr, Periodenr, Email, Telefoonnummer)
    activate ESB
    ESB->>ESB: Leest CSV-bestand
    ESB->>Objects API: Maakt Taak aan (met data uit CSV)
    activate Objects API
    Objects API-->>ESB: Taak aangemaakt (Succes/Fout)
    deactivate Objects API

    alt Succes
        ESB->>NotifyNL: API-call (Taakdetails)
        activate NotifyNL
        NotifyNL-->>ESB: Bevestiging
        deactivate NotifyNL
    end
```

## 2. Indienen formulier
De inwoner logt in op Mijn Nijmegen, waar de taak voor de inwoner klaarstaat. Deze bevat een verwijzing naar het statusformulier. Met deze link wordt
het statusformulier geopend, met vooringevuld de juiste gegevens uit de taak. De inwoner vult het formulier in en verzendt deze.

De ingezonden formuliergegevens worden door Open Forms in de taak gezet.
Op basis hiervan gaat een notificatie af (van objects API naar AWS):
- Een notificatie wordt op een queue gezet, waar de ESB op pollt, documenten worden in S3 gezet die in deze notificatie staat
De taakstatus wordt hierbij aangepast naar 'ingediend' door Open Forms

```mermaid
sequenceDiagram
    participant Inwoner
    participant Mijn Nijmegen
    participant Objects API
    participant Statusformulier
    participant AWS
    participant S3
    participant AWS Queue

    Inwoner->>Mijn Nijmegen: Logt in
    activate Mijn Nijmegen
    Mijn Nijmegen->>Objects API: Haalt Taak op (met link naar Statusformulier)
    activate Objects API
    Objects API-->>Mijn Nijmegen: Taak (met link)
    deactivate Objects API
    Mijn Nijmegen-->>Inwoner: Toont Taak (met link)
    deactivate Mijn Nijmegen

    Inwoner->>Statusformulier: Opent Statusformulier (met link)
    activate Statusformulier
    Statusformulier->>Objects API: Haalt Taak op (voor vooringevulde gegevens)
    activate Objects API
    Objects API-->>Statusformulier: Taak (met gegevens & taakstatus)
    deactivate Objects API
    Inwoner->>Statusformulier: Vult Formulier in & Verzendt
    Statusformulier->>Objects API: Zet Formuliergegevens in Taak & Past Taakstatus aan naar 'Ingediend'
    activate Objects API
    Objects API-->>Statusformulier: Bevestiging
    deactivate Objects API
    deactivate Statusformulier

    Objects API->>AWS: Notificatie taakwijziging
    activate AWS
    AWS->>S3: Save documents
    activate S3
    S3-->>AWS: Bevestiging
    deactivate S3
    AWS->>AWS Queue: Taak on queue
    activate AWS Queue
    AWS Queue-->>AWS: Bevestiging
    deactivate AWS Queue
    deactivate AWS
```

## 3. Verwerken inzending
De ESB pakt de inzending op (afh. van keuze, ofwel van queue of adhv notificatie vanuit taak) en verwerkt deze. De **beslisservice** bepaalt of de 
uitkering kan worden gedeblokkeerd, adhv. antwoorden. Dit bepaalt wat in suite/corsa moet worden aangemaakt. (Gelijk aan oude opzet). Hierbij:
- Moeten documenten opgehaald (uit S3 of ZGW documenten)
- Moet gecontroleerd worden of contactinfo gewijzigd is (email/telefoonnr)
- Moet de taakstatus aangepast naar 'verwerkt' (TODO: Check naamgeving statussen)
```mermaid
sequenceDiagram
    participant ESB
    participant AWS Queue
    participant Beslisservice
    participant Corsa Opslag
    participant Suite

    ESB->>AWS Queue: Pollt AWS Queue
    activate AWS Queue
    AWS Queue-->>ESB: Taak (Inzending)
    deactivate AWS Queue

    ESB->>Beslisservice: Stuurt Vereiste Velden (uit Taak)
    activate Beslisservice
    Beslisservice-->>ESB: Resultaat (Deblokkeren/Niet Deblokkeren)
    deactivate Beslisservice

    ESB->>Corsa Opslag: Opslaan Documenten (altijd)
    activate Corsa Opslag
    Corsa Opslag-->>ESB: Bevestiging
    deactivate Corsa Opslag

    alt Deblokkeren
        ESB->>Suite: Signaal (Deblokkeren)
        activate Suite
        Suite-->>ESB: Bevestiging
        deactivate Suite
    else Niet Deblokkeren
        ESB->>Suite: Start Werkproces (Niet Deblokkeren)
        activate Suite
        Suite-->>ESB: Bevestiging
        deactivate Suite
    end
```
