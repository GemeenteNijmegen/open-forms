# Submission Processing Monitor

Controleert of Objects-records uit een periode succesvol door de bestaande submission-forwarder Step Function zijn verwerkt.

## Read-only grens

Dit subsystem raakt de bestaande submission-forwarder niet aan. Het leest alleen bestaande Step Functions executions en de Objects API; het start, stopt of wijzigt geen executions en past de bestaande state machine, receiver, ObjectParser of resubmit-flow niet aan.

`objectUuid + objectIndex` is de technische identiteit van een Object-record. `reference` is een menselijke zoekwaarde en niet uniek.

## Configuratie

De monitor gebruikt eigen SSM-parameters en een eigen secret los van de bestaande submission-forwarder configuratie. Op die manier beheren we de rechten specifiek voor monitoring vanuit objects.

`submission-forwarder-state-machine-arn` hoeft niet handmatig ingevuld te worden: de submission-forwarder publiceert zijn eigen state machine ARN naar deze parameter, de monitor leest hem alleen.

## Object types (gedeeld met submission-forwarder)

`object-types` staat niet onder het eigen prefix van de monitor, maar op `/open-forms/object-types` . Aangemaakt in ParameterStage, niet in deze module. Dan blijven de receiver lambda en monitoring dezelfde objecttypes gebruiken die ontvangen kunnen worden, maar dus ook gemonitord.

Reden: de submission-forwarder's receiver Lambda gebruikt vandaag nog zijn eigen, auto-genereerde `objectTypes`-parameter
