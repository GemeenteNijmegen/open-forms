# OpenForms theme


## Tokens
Het open-forms thema maakt gebruik van tokens die te configureren zijn via JSON. Hierin kunnen we onze nijmegen en utrecht tokens laden. Maar dit heeft niet echt effect op wat we zien in de frontend.
OpenForms maakt gebruik van een eigen set aan tokens die we hier dus kunnen definieren. 
[Zie hiervoor de tokens file](./tokens.json)

Welke tokens er zijn kan via de token editor in de interface gevonden worden.

## Css
We kunnen ook een eigen CSS file defineren. Hierin zitten de zaken die we niet oplossen met de tokens maar direct met CSS aan willen passen.
Hier kan bijvoorbeeld ook de login knop hack worden uitgehaald.

Nu onder andere in gebruik voor:
- Het inladen van fonts


## Logo, privacy policy en andere stijl/organisatie dingen
In de open formulieren interface kan een organization configuration gevonden worden onder general configuration.
Hier kan een favicon, default theme, OIN etc. geconfigureerd worden.

![Logo](https://componenten.nijmegen.nl/v6.4.0/img/beeldmerklabel.svg)


## CSP
Omdat we resources van https://componenten.nijmegen.nl laaden moet deze toegevoegd worden aan de CSP.