# SSO In onze applicaties

## 1. Signicat SSO
- Voor andere apps: Forced relogin (checken in ODIC standaard)
- Keepalive?
- Central logout implementeren

- Andere voordelen:
  - Een centrale DigiD aansluiting
  - Verschillende portalen mogelijk met SSO

- Andere nadelen:
 - Extra complexiteit audit


## 2. Opnieuw inloggen (met DigiD sessie) - Huidige status
- 2 x inloggen via Mijn Nijmegen en OpenForms - Versnelling door sessie retention in DigiD app
- Voordeel: zo werkt het nu

## 3. Voor ESF - Directe link + DigiD
- Is niet fraai en mogelijk duur voor SMS
- Voor email geen probleem
- Mits notify wordt aangepast (geen AWS tracking in links)
- Verhoogd risico op phishing (?) (onderbuikgevoel)

## 4. Optie: Embedded forms in Mijn Nijmegen
- Geen idee of en hoe dit kan, termijn niet duidelijk
- Uitzoeken?
- SUPER FANCY

## 5. ~~Logius route~~ (mag niet meer)
- Wordt niet meer doorontwikkeld en mag niet meer gebruikt worden
- Ze hebben de makkelijke flow in de app waarin je geen koppelcode opnieuw hoeft te maken 
  - Werkt zelfs cross DigiD aansluiting (?)


## Advies
2. Om te beginnen (1e versie live)
1. Gaan we uitzoeken ondanks wens Jan
4. Willen wij graag.