# Aanvragen Sociaal Domein

Aanvragen Sociaal domein worden in hetzelfde aws account afgehandeld, maar in een andere repo. Een queue zit hiertussen
De connectie wordt gelegd met een een queue die alleen intern in het account gebruikt wordt.

```mermaid
flowchart TD
    AanvraagForm["Aanvraag Form"] --> Receiver
    Receiver --> S3FilesStore["S3Files Store"]
    S3FilesStore --> ZGWMakeZaak["ZGW make Zaak"]
    ZGWMakeZaak --> SociaalQueue["Send to Sociaal Queue"]
    ZGWMakeZaak -. Error .-> ErrorHandler["Error Alarm"]
```