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

Per versie komt terug: objectUuid, objectType (de URL), objectTypeName (de naam uit ssmObjectTypes, zoals esfTaak), index, registrationAt, en bij
een ESF-taak esfStatus (open, afgerond, verwerkt of gesloten). Andere objecttypes kunnen een status-veld met een andere betekenis hebben, daarom
alleen bij esfTaak. Alleen objecttypes die de receiver ook verwerkt (ssmObjectTypes) tellen mee.

De reader haalt zelf de base URL en de objecttypes uit SSM en het token uit Secrets Manager. Een periode die niet als 'YYYY-MM-DD' geschreven is,
of waarin lastDay voor firstDay ligt, geeft een fout.

Een powertools Logger meegeven kan met new ObjectReader({ logger }); zonder logger maakt de reader er zelf een. Elke API-call wordt op debug
gelogd met pad, queryparameters en status. Een mislukte call staat op error met de reden. Op info staan de namen van de geconfigureerde
objecttypes en aan het eind hoeveel Objects bekeken zijn, hoeveel een onbekend type hadden, de registratiedatum van het eerste Object in de
lijst, die van het Object waar de lijst stopte en hoe vaak de lijst gelezen is. Een onbekend type staat één keer als warn met de type-url, zodat
je hem naast de parameter kunt leggen. Moest de lijst opnieuw gelezen worden, dan staat de reden met de pagina als warn. Op trace staat per
leesronde elke pagina (count, aantal, eerste en laatste uuid met datum) en waar de lijst stopte, een uuid dubbel zag of de count zag veranderen.

## Hoe

De Objects API kent per record alleen een registratiedatum, geen tijd. Filteren op registrationDate geeft één record per Object, en dat is te weinig:
een ESF-taak kan op één dag open, afgerond en verwerkt worden. Daarom:

1. Objects ophalen, gesorteerd op de nieuwste registratie en binnen een dag op uuid, pagina voor pagina tot het huidige record van voor de
   periode is. Een Object dat na de periode nog gewijzigd is, kan een oudere versie in de periode hebben. Daarom stopt de reader niet op het
   einde van de periode.
2. Per gevonden Object de history ophalen en de records nemen die in de periode geregistreerd zijn.

De uuid in de sortering is nodig. De API pagineert met een offset (pagina 2 slaat de eerste 100 rijen over, pagina 3 de eerste 200) en elke pagina
is een losse query. Op alleen de datum ligt de volgorde binnen een dag niet vast, dus op een paginagrens viel een Object weg en kwam een ander
dubbel. Van de lijst vraagt de reader alleen uuid, type en registratiedatum op, zonder de data van het Object.

Omdat de API een onbekend sorteerveld stil negeert, controleert de reader de volgorde van elke rij. Klopt die niet, dan is dat een fout. Komt een
uuid twee keer voor, of verandert de count tussen de pagina's, dan is de lijst tijdens het lezen veranderd: een nieuw of gewijzigd Object schuift
alles een plek op. Dan leest de reader de lijst opnieuw, tot drie keer. Lukt het dan nog niet, dan is dat ook een fout.

Lukt een pagina niet, of is de lijst niet goed te lezen, dan gooit de reader een fout. Er komt nooit een half resultaat terug.
