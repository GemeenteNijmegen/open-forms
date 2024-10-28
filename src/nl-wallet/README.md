# NL Wallet beproeving
Om de NL Wallet (omsloten via Signicat en VerID) te beproeven maken we gebruik van open forms (SaaS) met wat extra lambdas/maatwerk (deze directory van de repo).

## OpenIDConnect koppelingen
Omdat open-formulieren niet direct OIDC koppelingen ondersteund wordt voor de beproeving de installatie misbruikt. 
De inrichting is als voligt:
- De DigiD (OIDC) pluging wordt gebruikt voor een OIDC koppeling naar Signicat met publiekrechtelijk (bsn dus) doel.
- De DigiD Machtigen (OIDC) pluging wordt gebruikt voor een OIDC koppeling naar Signicat met privaatrechtelijk (geen bsn dus) doel.

Omdat het BSN dat open-forms kent (dit is het attribuut `{{auth_bsn}}`) alleen uit het JWT token gehaald kan worden, is er een token caching service ingericht om de prefill voor elkaar te krijgen. Zie hieronder.

![Token cache service](./img/cache-service.drawio.png)

**Tl;dr** Open forms haalt het jwt token op via de chacing service en gebruikt de service om prefill van velden uit het token te doen. De key die hiervoor wordt gebruikt is de subject claim in het BSN.


## Confiugratie aan open formulieren kant
### Deel 1: De service configureren
- Maak een nieuwe service aan en voeg het domein en de API key toe, zie screenshot hieronder
![Prefill service config](./img/prefill-servcice-config.png)

- In het formulier kan je dan de velden prefillen door een logica regel toe te voegen
![Prefill form rule](./img/prefill-form-rule.png)
![Prefill form detail](./img/prefill-form-details.png)

### Deel 2: De OIDC configuratie
- De OIDC configuratie ziet er dan zo uit
![OIDC configuratie](./img/oidc-config.png)

## Implementatie token caching service
![Token cache service](./img/cache-service-impl.drawio.png)


## Thema
Er is een CSS file geconfigureerd met het theme deze is [hier te vinden](https://github.com/GemeenteNijmegen/openforms-test-temp/tree/acceptance/nl-wallet-theme).
Het thema kan aangemaakt worden in de beheer interface van OF. 
- Upload de CSS file en het logo. 
- Selecteer dan in de formulier configuratie het aangemaakte thema.
- Done, het formulier en de inlog methoden zeggen nu 'Inloggen met uw ID Wallet'