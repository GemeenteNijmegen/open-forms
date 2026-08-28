# Submission Processing Monitor

Controleert of Objects-records uit een periode succesvol door de bestaande submission-forwarder Step Function zijn verwerkt.

## Read-only grens

Dit subsystem raakt de bestaande submission-forwarder niet aan. Het leest alleen bestaande Step Functions executions en de Objects API; het start, stopt of wijzigt geen executions en past de bestaande state machine, receiver, ObjectParser of resubmit-flow niet aan.

## Configuratie

De monitor gebruikt eigen SSM-parameters en een eigen secret los van de bestaande submission-forwarder configuratie. Op die manier beheren we de rechten specifiek voor monitoring vanuit objects.

`submission-forwarder-state-machine-arn` hoeft niet handmatig ingevuld te worden: de submission-forwarder publiceert zijn eigen state machine ARN naar deze parameter, de monitor leest hem alleen.

## Object types (gedeeld met submission-forwarder)

`object-types` staat niet onder het eigen prefix van de monitor, maar op `/open-forms/object-types` . Aangemaakt in ParameterStage, niet in deze module. Dan blijven de receiver lambda en monitoring dezelfde objecttypes gebruiken die ontvangen kunnen worden, maar dus ook gemonitord.

Reden: de submission-forwarder's receiver Lambda gebruikt vandaag nog zijn eigen, auto-genereerde `objectTypes`-parameter

## Hoe een run werkt

Elke nacht om 6 uur scant de monitor eerst alle Objects van de vorige dag, en daarna de submission-forwarder executions uit hetzelfde venster. Pas als beide compleet zijn worden ze tegen elkaar gelegd. Het executievenster loopt iets door na de periode zelf, tot het moment dat de run zelf start - een Object vlak voor middernacht kan pas seconden later een execution krijgen.

Matching gaat op de object-uuid. Bij twijfel (meerdere indexen, meerdere executions, een rare status) wordt nooit gegokt, dat wordt gewoon als ambigu gemarkeerd. Reference is fijn om op te zoeken maar niet uniek, de echte identiteit van een probleem is uuid + index.

## ESF

ESF-taken hebben een eigen status (open, afgerond, verwerkt, gesloten). Alle statussen tellen mee, maar of de step function het al opgepakt moet hebben checken we pas bij afgerond. Het clientnummer is al vanaf open bekend, ruim voor er een reference is.

## Problemen en rapport

Niet-verwerkte of dubbelzinnige records blijven staan als probleem tot ze zijn opgelost, en komen terug in het ochtendrapport. ESF-problemen krijgen een eigen mail, met alleen reference, clientnummer (interne referentie) en status.

## Tijd

Eén Lambda, 15 minuten. Als een scan te weinig tijd overhoudt stopt hij netjes op een paginagrens en wordt de hele run incomplete - liever een duidelijke melding dan een half rapport. Geen aparte Step Function, queue of tussenopslag nodig bij deze volumes.
