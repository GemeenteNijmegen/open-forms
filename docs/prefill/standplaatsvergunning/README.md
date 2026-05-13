### 1. Wat doet het eindpunt voor standplaatsvergunning?

Het eindpunt `/prefill/standplaatsvergunning` doet twee dingen, afhankelijk van hoe je het aanroept:

**A. Opties ophalen**
Als je de parameter `standplaatsOpties` meestuurt (de waarde maakt niet uit), geeft het eindpunt een lijst van beschikbare keuzes terug voor de vraag "Wat wilt u doen?".

**B. Legeskosten berekenen**
Zonder die parameter berekent het eindpunt de legeskosten op basis van de invoer. Het geeft dan een getal terug, bijvoorbeeld `{ "value": 125.8 }`.


### 2. Welke keuzes zijn beschikbaar?

De optieslijst bevat altijd deze vier opties:

| Waarde | Label |
|---|---|
| `gemeentegrond` | Standplaatsvergunning gemeentegrond aanvragen |
| `priveterrein` | Standplaatsvergunning privéterrein aanvragen |
| `aanpassen` | Standplaatsvergunning aanpassen of stopzetten |
| `vervanger` | Vervanger standplaatsvergunning doorgeven |

Daarnaast komen er **seizoensgebonden opties** bij op basis van de huidige datum:

| Optie | Periode |
|---|---|
| `koningsdag` | 1 januari t/m 1 maart |
| `concerten` | 25 maart t/m 4 mei |
| `winter` | 12 augustus t/m 27 augustus |


### 3. Hoe worden de legeskosten berekend?

De berekening hangt af van de waarde van `watWiltUDoen`:

| Keuze | Voorwaarde | Bedrag |
|---|---|---|
| `koningsdag` | — | € 125,80 |
| `winter` | — | € 125,80 |
| `gemeentegrond` of `priveterrein` | Duur ≤ 42 dagen | € 125,80 |
| `gemeentegrond` of `priveterrein` | Duur > 42 dagen | € 409,65 |
| `concerten` | Eindtijd ≤ 22:00 | € 125,80 |
| `concerten` | Eindtijd > 22:00, of concert loopt door na middernacht | € 284,60 |


### 4. Welke velden zijn verplicht per keuze?

| Keuze | Verplichte velden |
|---|---|
| `koningsdag`, `winter` | Geen extra velden |
| `gemeentegrond`, `priveterrein` | `startdatum` en `einddatum` (formaat: `YYYY-MM-DD`) |
| `concerten` | `tijdStartConcerten` en `tijdEindeConcerten` (formaat: `HH:MM` of `HH:MM:SS`) |

**Let op:** einddatum moet ná startdatum liggen. Tijden moeten geldig zijn (bijv. `08:00`, niet `8:00`).


### 5. Hoe werkt de foutafhandeling?

Als de invoer niet klopt, geeft het eindpunt een HTTP 400-fout terug met een gestructureerde uitleg:

```json
{
  "error": "Invalid request",
  "issues": [
    { "field": "einddatum", "message": "einddatum is required for gemeentegrond" }
  ]
}
```

Dit maakt het makkelijker om in het formulier gerichte foutmeldingen te tonen.

---

### 6. Hoe kun je het testen?

Er is een Bruno-testcollectie toegevoegd (map `bruno/`). Daarmee kun je het eindpunt op de acceptatieomgeving testen:

```
GET https://form-api.open-forms-accp.csp-nijmegen.nl/prefill/standplaatsvergunning?watWiltUDoen=koningsdag
```

---

### Samengevat voor formulierbouwers

- Gebruik `?standplaatsOpties=true` om de keuzelijst op te halen (seizoensgebonden).
- Stuur de juiste velden mee per keuze om de legeskosten te berekenen.
- Lege velden worden genegeerd; ongeldige waarden geven een duidelijke foutmelding terug.
