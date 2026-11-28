# Mapping Energieloket

Per formulierveld het veld in het objecttype en waar het in Tribe terechtkomt. Team Online gebruikt de eerste twee kolommen om in de registratie naar de Objecten-API elke formuliervariabele aan een objectveld te koppelen. Dezelfde uitleg staat per veld in de beschrijving in het objecttype, [TribeVerzoek.json](../../../schema/TribeVerzoek.json). Hoe de records in Tribe samenhangen, staat in het [datamodel](datamodel.md).

Objectvelden staan hier zonder het voorvoegsel `energieloket.`: `aanvrager.naam` is `energieloket.aanvrager.naam`.

## Koppelen in Open Formulieren

De algemene velden staan bovenin het object, naast `energieloket`, en zijn gelijk voor beide formulieren. Koppel ze zoals bij het Autodelen-formulier.

| Objectveld | Waarde |
|---|---|
| `tribeEnvironment` | Vast: `ENERGIELOKET`. |
| `tribeSubmissionType` | Vast: `ENERGIELOKET_INWONER` of `ENERGIELOKET_VVE`. |
| `formName` | Vast: de naam van het formulier. De interne melding noemt hem in onderwerp en tekst. |
| `reference` | De publieke referentie van de inzending. |
| `pdf` | De URL van de pdf die Open Formulieren altijd van de aanvraag maakt, zoals bij de andere objecttypes. |
| `attachments` | De URL's van alle bijlagen, een lege lijst als er geen zijn, zoals bij de andere objecttypes. Bij het VvE-formulier de bestanden uit `toevoegen`. Er zijn geen aparte bestandsvelden in `energieloket`. |
| `internalNotificationEmails` | Optioneel: adressen die een melding krijgen bij een nieuwe inzending. |
| `bsn`, `kvk`, `csv`, `networkShare`, `monitoringNetworkShare`, `submissionValuesToFiles`, `bsnOrKvkToFile` | Niet koppelen: een inzending met `tribeEnvironment` gaat na de opslag in S3 direct naar Tribe en gebruikt deze velden niet. |

Selectievakjes koppel je als geheel: Open Formulieren levert een object met per optie `true` of `false`, zoals `{"dakisolatie": true, "ventilatie": false}`. Een herhalende groep is in Open Formulieren één variabele met een lijst als waarde; die koppel je als geheel. Het objecttype legt de inhoud van de items niet vast: elk item is een object met de sleutels uit het formulier, welke dat ook zijn.

Een veld dat het formulier niet vraagt, laat je ongekoppeld. Alle velden in `energieloket` zijn optioneel en mogen leeg of null zijn; een leeg of ontbrekend veld gaat niet naar Tribe en geeft geen fout. Er zijn geen vaste lijsten van toegestane waarden (geen enum): een keuze is tekst met de waarde uit het formulier, en de beschrijving noemt de opties die de koppeling herkent. Het formulier zet niets om naar een Tribe-keuzelijst; dat doet de koppeling.

## Formulier inwoner

| Formulierveld | Objectveld | Tribe |
|---|---|---|
| `naam` | `aanvrager.naam` | Persoon: naam (zie [Naam](#naam)) |
| `eMailadres` | `aanvrager.emailadres` | Persoon: E-mail address |
| `telefoonnummer` | `aanvrager.telefoonnummer` | Persoon: Telephone number |
| `hoeWiltUDatDeGemeenteContactMetUOpneemtOverUwAanvraagAlsDatNodigIs` | `aanvrager.contactVoorkeur` | notitie |
| `postcode` | `adres.postcode` | Woning: Postcode; Adres: Postal code |
| `huisnummer` | `adres.huisnummer` | Woning: Huisnummer en Huisnummertoevoeging; Adres: Number en Addition |
| `straatnaam` | `adres.straatnaam` | Woning: Straat; Adres: Street |
| `woonplaats` | `adres.woonplaats` | Woning: Woonplaats (keuzelijst); Adres: City |
| `omWelkSoortHuisGaatHet` | `woning.soort` | Woning: Woningtype (keuzelijst) |
| `inWelkJaarIsHetHuisGebouwd` | `woning.bouwjaar` | Woning: Bouwjaar |
| `gasverbruikPerJaarM3` | `woning.gasverbruikM3` | Woning: Gasverbruik per jaar (m3) |
| `elektriciteitsverbruikPerJaarKWh` | `woning.elektriciteitsverbruikKWh` | Woning: Elektriciteitsverbruik per jaar (kWh) |
| `hoeWordtHetHuisVerwarmd` | `woning.verwarming` | Woning: Verwarmingssysteem (keuzelijst) |
| `hoeWordtHetHuisDanVerwarmd` | `woning.verwarmingAnders` | Woning: Ander verwarmingssysteem |
| `hoeOudIsDitSysteem` | `woning.verwarmingLeeftijd` | Woning: Leeftijd verwarmingssysteem |
| `welkeVerbeteringenZijnAlGedaan` | `woning.verbeteringenGedaan` | Woning: Gedane verbetering(en) (keuzelijst, meerdere) |
| `welkeVerbeteringenZijnDanGedaan` | `woning.verbeteringenGedaanAnders` | Woning: Andere verbetering(en) |
| `watZijnUwWensen` | `woning.wensen` | Woning: Wensen voor verbetering (keuzelijst, meerdere) |
| `watZijnUwWensenDan` | `woning.wensenAnders` | Woning: Andere wens(en) |
| `hoeHeeftUVanHetEnergieloket` | `bekendheid.kanalen` | Woning: Andere bekendheid Energieloket (tekst) |
| `hoeHeeftUDanVanHetEnergieloketGehoord` | `bekendheid.anders` | Woning: Andere bekendheid Energieloket (tekst) |
| `welkeKrantOfWijkblad` | `bekendheid.krantOfWijkblad` | Woning: Andere bekendheid Energieloket (tekst) |
| `welkeWebsite` | `bekendheid.website` | Woning: Andere bekendheid Energieloket (tekst) |
| `welkeSocialeMedia` | `bekendheid.socialeMedia` | Woning: Andere bekendheid Energieloket (tekst) |
| `welkeActie` | `bekendheid.actie` | Woning: Andere bekendheid Energieloket (tekst) |
| `welkeNieuwsbrief` | `bekendheid.nieuwsbrief` | Woning: Andere bekendheid Energieloket (tekst) |

## Formulier VvE

| Formulierveld | Objectveld | Tribe |
|---|---|---|
| `uwNaam` | `aanvrager.naam` | Persoon: naam (zie [Naam](#naam)) |
| `eMailadres` | `aanvrager.emailadres` | Persoon: E-mail address |
| `telefoonnummer` | `aanvrager.telefoonnummer` | Persoon: Telephone number |
| `hoeWiltUDatDeGemeenteContactMetUOpneemtOverUwAanvraagAlsDatNodigIs` | `aanvrager.contactVoorkeur` | notitie |
| `uwGasverbruikPerJaarM3` | `woning.gasverbruikM3` | notitie |
| `uwElektriciteitsverbruikPerJaarKWh` | `woning.elektriciteitsverbruikKWh` | notitie |
| `hoeWordtUwHuisVerwarmd` | `woning.verwarming` | notitie |
| `hoeWordtUwHuisDanVerwarmd` | `woning.verwarmingAnders` | notitie |
| `uitWelkJaarIsDitSysteem` | `woning.verwarmingJaar` | notitie |
| `hoeWordtUwHuisGeventileerd` | `woning.ventilatie` | notitie |
| `hoeWordtUwHuisDanGeventileerd` | `woning.ventilatieAnders` | notitie |
| `naamVanDeVvE` | `vve.naam` | VvE: Naam VvE |
| `welkeAdressenHorenBijDeVvENoemElkeStraatEnDeHuisnummersPerStraatNoemtUHetLaagsteEnHetHoogsteHuisnummer` | `vve.adressen` | notitie, per item elke sleutel met zijn waarde |
| `aantalHuizenBinnenDeVvE` | `vve.aantalWoningen` | VvE: Aantal adressen |
| `omWelkSoortHuizenGaatHet` | `vve.soortWoningen` | notitie (zie [Keuzelijsten](datamodel.md#keuzelijsten)) |
| `welkSoortHuizenDan` | `vve.soortWoningenAnders` | notitie |
| `inWelkJaarZijnDeHuizenGebouwd` | `vve.bouwjaar` | VvE: Bouwjaar woningen |
| `zijnErNaastKoophuizenOokHuurhuizenBinnenDeVvE` | `vve.huurwoningen` | VvE: Verhouding eigendom, en notitie |
| `inHoeveelProcentVanDeHuizenOfAppartementenWoontDeEigenaarZelf1` | `vve.percentageEigenaarBewoners` | VvE: Percentage EB |
| `omWelkSoortHuurhuizenGaatHet` | `vve.soortVerhuur` | notitie |
| `isErEenHoofdEnOndersplitsingBinnenDeVvE` | `vve.hoofdEnOndersplitsing` | VvE: Hoofd- en ondersplitsing? (zie [Ja, nee, onbekend](#ja-nee-onbekend)) |
| `welkeAndereFunctieSDanWonenZijnEr` | `vve.andereFuncties` | notitie |
| `uitWelkJaarIsDeSplitsingsakte` | `vve.jaarSplitsingsakte` | VvE: Jaar splitsingsakte |
| `isErEenMeerjarenonderhoudsplanMjop1` | `vve.mjop` | VvE: Is er een MJOP? |
| `heeftDeVvEEenDuurzaamheidscommissie` | `vve.duurzaamheidscommissie` | VvE: Is er een duurzaamheidcommissie? |
| `welkeVerbeteringenZijnAlDoorDeVvEGedaan` | `vve.verbeteringenGedaan` | VvE: Andere verbetering gedaan (tekst) |
| `welkeVerbeteringenZijnDanGedaan` | `vve.verbeteringenGedaanAnders` | VvE: Andere verbetering gedaan (tekst) |
| `welkeVerbeteringenWiltUOfUwVvEDoen` | `vve.verbeteringenGewenst` | VvE: Andere wens |
| `splitsingsakte` | `vve.splitsingsakteToegevoegd` | notitie |
| `meerjarenonderhoudsplanMjop` | `vve.mjopToegevoegd` | notitie |
| `hoeHeeftUVanHetEnergieloketGehoord` | `bekendheid.kanalen` | notitie |
| `hoeHeeftUDanVanHetEnergieloketGehoord` | `bekendheid.anders` | notitie |
| `welkeKrantOfWijkblad` | `bekendheid.krantOfWijkblad` | notitie |
| `welkeWebsite` | `bekendheid.website` | notitie |
| `welkeSocialeMedia` | `bekendheid.socialeMedia` | notitie |
| `welkeActie` | `bekendheid.actie` | notitie |
| `welkeNieuwsbrief` | `bekendheid.nieuwsbrief` | notitie |
| `hetIsSomsMogelijkDatHetAdviesgesprekBijUThuisIsDeAdviseurNeemtDanVanTevorenContactMetUOpWiltUHetGesprekBijUThuis` | `afspraak.huisbezoekGewenst` | notitie |

## Velden voor later

Deze velden vraagt nog geen formulier. Ze staan in het objecttype zodat een formulier de vraag kan toevoegen zonder nieuwe versie. Koppel een veld alleen als het formulier die vraag stelt. De koppeling vult het Tribe-veld zodra het objectveld gevuld is, behalve waar "nog niet gebruikt" staat: daar is eerst een wijziging in de koppeling nodig.

| Objectveld | Tribe |
|---|---|
| `aanvrager.voornaam`, `aanvrager.tussenvoegsel`, `aanvrager.achternaam` | Persoon: First name, Prefix, Surname |
| `aanvrager.adres` (postcode, huisnummer, huisnummertoevoeging, straatnaam, woonplaats) | Adres van de Persoon, als het privé-adres anders is dan het adres van de woning |
| `adres.huisnummertoevoeging` | Woning: Huisnummertoevoeging; Adres: Addition |
| `woning.eigenaarBewoner` | Woning: Eigenaar/bewoner?; Particulier: Eigenaar/bewoner |
| `woning.energielabel` | Woning: Energielabel (keuzelijst) |
| `woning.monument` | Woning: Monument? (ja of nee) |
| `woning.buurt` | Woning: Buurt (keuzelijst Wijk); de naam van de wijk als tekst |
| `woning.slechtGeisoleerdeBouwdelen` | Woning: Slecht geïsoleerde bouwdelen (keuzelijst, meerdere) |
| `vve.verhoudingEigendom` | VvE: Verhouding eigendom (keuzelijst alleen koop, alleen huur, mix; de koppeling vertaalt de formulierwaarde) |
| `vve.wensen` | VvE: Andere wens (tekst; Wensen voor verbetering heeft één waarde) |
| `vve.contactpersonen` (per persoon naam, voornaam, tussenvoegsel, achternaam, emailadres, telefoonnummer) | Geen veld maar records: nog niet gebruikt. Bedoeld voor een Persoon met Particulier per contactpersoon, gekoppeld aan de VvE via Individual persons. |
| `afspraak.huisbezoekGewenst` (formulier inwoner) | Woning: Huisbezoek? |
| `afspraak.opmerkingen` | notitie |

## Tribe-velden zonder objectveld

Woning en VvE hebben veel meer velden dan de formulieren. Deze vult het loket zelf, tijdens of na het gesprek; een formulier vraagt ze niet, daarom staan ze niet in het objecttype.

| Tribe-velden | Waarom niet |
|---|---|
| Woning: oppervlaktes van uitgevoerde isolatie, glas en deuren (DHZ en derden, in m2) | Uitvoering, door het loket bijgehouden. |
| Woning: subsidierecht, subsidie aangevraagd, toegekend bedrag, minimale oppervlakte en isolatiewaarde | Subsidieadministratie. |
| Woning: CO2-gestuurde ventilatie, balansventilatie met WTW, jaar uitvoering maatregel(en) | Uitgevoerde maatregelen. |
| Woning: datum loketgesprek, gesprek adviseur | Het gesprek zelf; de koppeling wijst geen adviseur toe. |
| Woning: WOZ 2023, Vragenlijst ingevuld?, fase | Door het loket in te vullen. |
| Woning: Bekendheid Energieloket (keuzelijst) | Eén waarde, het formulier staat er meer toe; gaat als tekst in Andere bekendheid Energieloket. |
| VvE: Wensen voor verbetering, Verbeteringen door VvE (keuzelijst) | Eén waarde; gaat als tekst in Andere wens en Andere verbetering gedaan. |
| VvE: de twee bestandsvelden | Bijlagen komen in `attachments`, zoals bij de andere objecttypes. |
| Persoon: geboortedatum, geslacht, initialen, titel, identificatie | Niet nodig voor een adviesgesprek. |
| Persoon: Mobile number | De formulieren vragen één telefoonnummer; dat gaat naar Telephone number. |
| Adres: land, coördinaten | Alleen adressen in Nederland; Tribe heeft geen coördinaten nodig. |

## Verwerking

### Naam

Beide formulieren hebben één naamveld, Tribe heeft voornaam, tussenvoegsel en achternaam. Zijn `aanvrager.voornaam` of `aanvrager.achternaam` gevuld, dan gebruikt de koppeling die. Anders komt `aanvrager.naam` in zijn geheel in de achternaam.

### Keuzelijsten

Een keuzewaarde uit het formulier gaat naar de bijbehorende waarde in de Tribe-keuzelijst. Heeft een waarde geen tegenhanger, dan komt hij als tekst in het bijbehorende veld "Ander(e) ..." of in de notitie. De verwerking stopt daar niet op. "(tekst)" in de tabellen betekent dat een keuzeveld bewust als tekst gaat, omdat het formulier meerdere antwoorden toestaat en Tribe één.

### Huisnummer en postcode

`adres.huisnummer` mag een toevoeging bevatten. Is `adres.huisnummertoevoeging` leeg, dan splitst de koppeling `12a` in `12` en `a`. In Adres is het nummer een getal. De postcode gaat zonder spatie en in hoofdletters naar Tribe, zoals het loket ze invoert.

### Ja, nee, onbekend

VvE-vragen met `ja`, `nee` en `onbekend` gaan naar een ja/nee-veld in Tribe. Bij `onbekend` blijft het veld leeg en staat het antwoord in de notitie, want een leeg veld en nee zien er in Tribe hetzelfde uit.

## Vragen en antwoorden

Waarom staan er velden in het objecttype die geen formulier vraagt?

Een nieuwe versie van het objecttype moet op acceptatie en productie gepubliceerd worden, en Team Online moet de registratie daarna opnieuw nalopen, ook voor Autodelen. Daarom staat er in één keer in wat een formulier redelijkerwijs kan vragen en waarvoor Tribe een plek heeft.

Wat gebeurt er als een formulier een optie toevoegt die Tribe niet kent?

De inzending gaat gewoon door. Het antwoord komt als tekst in het veld "Ander(e) ..." of in de notitie, en de logs tonen welk objectveld het betrof.
