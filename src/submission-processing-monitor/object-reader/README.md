# Object reader

Haalt uit de Objects API alle versies van Objects die in een periode geregistreerd zijn. Eén versie is één record: uuid plus index.
De reader verzamelt alleen feiten. Of een versie goed verwerkt is, bepaalt later de matcher met de logs van de submission log reader.

```ts
import { ObjectReader } from './object-reader/ObjectReader';

const reader = new ObjectReader();
const versions = await reader.findVersions({ firstDay: '2026-11-01', lastDay: '2026-11-03' });
const yesterday = await reader.findVersions();
```

Dagen worden geschreven zoals in de Objects API, in Amsterdamse tijd. Beide dagen horen erbij. Zonder periode is het de vorige dag.

Per versie komt terug: objectUuid, objectType (de URL), objectTypeName (de naam uit ssmObjectTypes, zoals esfTaak), index, registrationAt, en de
status uit data als die er is (bij ESF-taken). Alleen objecttypes die de receiver ook verwerkt (ssmObjectTypes) tellen mee.

Een powertools Logger meegeven kan met new ObjectReader({ logger }); zonder logger maakt de reader er zelf een. Elke API-call wordt op debug
gelogd met pad, queryparameters en status. Een mislukte call staat op error met de reden.

## Hoe

De Objects API kent per record alleen een registratiedatum, geen tijd. Filteren op registrationDate geeft één record per Object, en dat is te weinig:
een ESF-taak kan op één dag open, afgerond en verwerkt worden. Daarom:

1. Objects ophalen, gesorteerd op de nieuwste registratie, pagina voor pagina tot het huidige record van voor de periode is.
   Een Object dat na de periode nog gewijzigd is, kan een oudere versie in de periode hebben. Daarom stopt de reader niet op het einde van de periode.
2. Per gevonden Object de history ophalen en de records nemen die in de periode geregistreerd zijn.

Lukt een pagina niet, dan gooit de reader een fout. Er komt nooit een half resultaat terug.
