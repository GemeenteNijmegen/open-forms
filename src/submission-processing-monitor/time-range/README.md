# Time range

Rekent met kalenderdagen in Europe/Amsterdam. De monitor controleert per Amsterdamse dag, standaard gisteren. De Objects API schrijft die dag als
datum zonder tijd, CloudWatch zoekt in een absoluut tijdvak. De readers zelf rekenen niet met tijdzones.

JavaScript Date kent alleen UTC en de lokale tijd van de machine, daarom werkt deze code met Intl en ziet het er nog steeds zo omslachtig uit. Vanaf Node.js 26 zit Temporal standaard in
Node.js. Als het project en de Lambda-runtime daarop zitten, kunnen beide functies beter naar Temporal omgebouwd worden. Het doel, de invoer en de
uitvoer hieronder blijven dan gelijk, en de tests in test/AmsterdamTimeRange.test.ts moeten ongewijzigd blijven slagen.

```ts
import { amsterdamCalendarDayToAbsoluteTimeRange, previousAmsterdamCalendarDay } from '../time-range/AmsterdamTimeRange';

const range = amsterdamCalendarDayToAbsoluteTimeRange({ year: 2026, month: 3, day: 29 });
// fromInclusive 2026-03-28T23:00:00Z, toExclusive 2026-03-29T22:00:00Z

const yesterday = previousAmsterdamCalendarDay();
// bijvoorbeeld '2026-11-17' als het in Amsterdam 18 november is
```

## amsterdamCalendarDayToAbsoluteTimeRange

Doel: het tijdvak in UTC van één Amsterdamse dag, om in CloudWatch te zoeken met de submission log reader.

- Invoer: { year, month, day }, met month 1-12.
- Uitvoer: { fromInclusive, toExclusive } als Date. fromInclusive is middernacht aan het begin van de dag in Amsterdam, toExclusive middernacht
  aan het begin van de volgende dag. toExclusive hoort niet bij de dag, dus de toExclusive van de ene dag is precies de fromInclusive van de volgende.

Op de dag dat de klok vooruit gaat duurt een dag 23 uur, op de dag dat hij terug gaat 25 uur. De klok verspringt om 02:00 of 03:00, dus
middernacht is altijd eenduidig.

Getest: een winterdag, een zomerdag, beide overgangsdagen, de maand- en jaargrens, en dat opeenvolgende dagen op elkaar aansluiten.

## previousAmsterdamCalendarDay

Doel: de standaardperiode van de object reader, gisteren in Amsterdam, geschreven zoals de Objects API datums schrijft.

- Invoer: now als Date, standaard het huidige moment. Alleen een test geeft hem mee.
- Uitvoer: de dag voor de Amsterdamse kalenderdag van now, als 'YYYY-MM-DD'.

Er gaat één kalenderdag af, niet 24 uur. Na een dag van 23 of 25 uur zou 24 uur terug net op de verkeerde dag uitkomen.

Getest: net na middernacht in Amsterdam terwijl het in UTC nog de avond ervoor is, de dag na beide overgangen, en de jaargrens.
