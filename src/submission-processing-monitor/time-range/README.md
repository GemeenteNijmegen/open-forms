# Time range

Zet een lokale Europe/Amsterdam-kalenderdag om naar de AbsoluteTimeRange die de reader accepteert. De reader zelf doet geen tijdzoneconversie, dat gebeurt hier.

Een kalenderdag is { year, month, day }, middernacht tot middernacht in Amsterdamse tijd, niet in UTC. Een AbsoluteTimeRange is half-open: fromInclusive hoort erbij, toExclusive niet. De toExclusive van dag N is daardoor exact de fromInclusive van dag N+1.

Amsterdam wisselt tussen CET en CEST. Die overgang gebeurt om 02:00 of 03:00 lokale tijd, nooit om middernacht, dus de omzetting van middernacht zelf is altijd eenduidig.

Objects-timestamps zijn nog niet uitgewerkt. Er is nu geen Objects API-client in deze repo, dus het formaat en de tijdzone daarvan staan nog niet vast.

## Hoe de omzetting werkt

De kalendercijfers worden eerst behandeld alsof ze al UTC waren, en dat gok wordt daarna gecorrigeerd met de echte Amsterdam-offset op dat moment (via Intl, geen extra dependency nodig). Zie AmsterdamTimeRange.ts voor de twee functies die dat doen.

## Scenario's

Winterdag, zomerdag, de 23-uursdag (voorjaar, klok een uur vooruit) en de 25-uursdag (najaar, klok een uur terug), plus maand- en jaargrens. Staat allemaal in test/AmsterdamTimeRange.test.ts, met de verwachte waarden vooraf gecontroleerd via een los Node-scriptje, niet alleen met de hand uitgerekend.
