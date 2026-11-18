# Time range

Zet een kalenderdag in Europe/Amsterdam om naar de AbsoluteTimeRange die de submission log reader accepteert.
De reader zelf rekent niet met tijdzones.

```ts
import { amsterdamCalendarDayToAbsoluteTimeRange } from '../time-range/AmsterdamTimeRange';

const range = amsterdamCalendarDayToAbsoluteTimeRange({ year: 2026, month: 3, day: 29 });
// fromInclusive 2026-03-28T23:00:00Z, toExclusive 2026-03-29T22:00:00Z
```

Een dag loopt van middernacht tot middernacht in Amsterdamse tijd. fromInclusive hoort bij de dag, toExclusive niet,
dus de toExclusive van de ene dag is precies de fromInclusive van de volgende. Op de dag dat de klok vooruit gaat
duurt een dag 23 uur, op de dag dat hij terug gaat 25 uur. De klok verspringt om 02:00 of 03:00, dus middernacht is
altijd eenduidig. De omzetting gebruikt Intl en heeft geen extra dependency nodig.

De tests in test/AmsterdamTimeRange.test.ts dekken een winterdag, een zomerdag, beide overgangsdagen en de maand- en jaargrens.

Objects-timestamps zijn nog niet uitgewerkt. Er is nu geen Objects API-client in deze repo, dus het formaat en de
tijdzone daarvan staan nog niet vast.
