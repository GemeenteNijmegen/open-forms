# Aantekeningen bouwdag 1


## Losse notificaties vs workflow based
- Timing problemen bij losse notificaties
- Afhankelijkheid van Corsa bij aanmaken wanneer we losse notificaties doen (opsparen notificaties tot coras weer online is)
- Conclusie: workflow based (zaak aangemaakt -> naar corsa syncen)
- Let op: er is dan een losse flow nodig om later toegevoegde documenten ook naar corsa te krijgen


## Welke andere opties ipv zelfbouw workflow of basic bashboard
- Apart bouwen is microservice, geen wildgroei aan microservices wenselijk
- 

Alternatieve die ter spraken kwamen
- Mule - ???
- GZAC - heel groot voor het hele process, niet perse voor dit mini technische deel.
- Step function - Geen beheer interface in AWS, we willen beheer misschien wel ergens anders neerleggen.


- Conclusie: we gaan voor een basic dashboard, dit kan beheer bij applicatie beheerleggen. Workflow oplossing kunnen we later nog heen werken. Dit is beter te testen.



## Pitfalls
- Z-nummmer bijwerken later (notificatie terugsturen)
- 