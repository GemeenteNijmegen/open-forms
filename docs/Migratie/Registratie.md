# Registratie

We hebben momenteel een aantal smaken formulier registratie:
1. Netwerkschijf
2. Zgw registratie (Rx.Mission)
3. SNS notificatie (Woweb)
4. Overig - een 3/4 tal formulieren waar de ESB inhoudelijk iets mee doet.

## 1. Netwerkschijf formulieren
Hiervoor zien we momenteel twee opties: 
1. We onderzoeke nu of we deze kunnen laten landen op een sharepoint site met de plugin die open-formulieren hiervoor heeft.
  - Dit betekent dat de ESB koppeling voor de netwerkschijf niet meer nodig is (let op: wel voor punt 4 hierboven genoemd).
2. De formulieren op exact dezelfde manier aanbieden aan de ESB als nu het geval is.
  - Dit betekent geen impact op de ESB
  - Deze route betekent de volgende keten: OpenFormulieren -> ZGW & objecten API -> Oppakken in AWS en klaar zetten voor de ESB -> ESB (via bestaande koppeling)
    - "Oppakken in AWS en klaar zetten voor de ESB" - Dit onderdeel moet dan nog door DevOps gebouwd worden.

## 2. Zgw relaties
Kunnen we de directe ZGW koppeling voor gebruiken in open-formulieren. Dit vergt wat configuratie.

## 3. SNS notificatie
Hiervoor moet Woweb werk verichten, we gaan hier waarschijnlijk de ZGW registratie voor gebruiken.
Dit vergt afstemming met Woweb, maar die staan hier wel voor open.

## 4. Overig
Dit moeten we uitzoeken, en krijgen we terug van de ESB.