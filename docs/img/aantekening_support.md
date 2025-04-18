# Aantekeningen export/import

- Namen van API groups & catalogus & zaaktypen moeten hetzelfde zijn tussen acceptatie en productie!
- Laurens (en wij ook) kan het UUID aanpassen
- Formulier import van stappen werken op basis van SHA (dus andere componenten met zelfde uuid maakt een nieuw formulier.)


Alternatief bevestigingsmail
- Hidden field opnemen met bevestigingsmail standaard vullen met afdeling
- Dan kunnen we ook met logica werken in het formulier


Probleem zelf veroorzaken, door bijvoorbeeld:
- Currency veld standaard op 0,00 zetten
- Onzichtbaar
- Wissen als veld verborgen is
- Trigger in stap zelf om zichtbaar te zetten
-> Veld wordt `null` ipv 0,00 frontend zegt dat dat door de gebruiker komt en niet door de standaard value, dus veld is invallid.


