
## VIP specifics in formulieren

### Zaaktype
Veel formulieren bevatten het volgende component
```json
{
  "label": "vipZaaktype",
  "customClass": "vipzaaktypefield hiddenfield",
  "tableView": true,
  "calculateValue": "if(data.soortEvenement == 'voetbal') {\n  value = 'fc669b32-7f54-49e7-a452-9b6340bd1524';\n}else if(data.regelsBootfeest == 'nee' || data.regelsEvenement == 'nee' || data.regelsOpenbareRuimte == 'nee') {\n  value = '8fbd51c8-6cf8-4fad-863e-900ace122dc3';\n} else {\n  value = '707d70e2-5a4c-4e8d-9930-0562ade8cf80';\n}",
  "key": "vipZaaktype",
  "type": "textfield_nijmegen",
  "input": true,
  "lockKey": true,
  "source": "60dc49b735e1524b3f603103",
  "isNew": true
}
```

### VIP KEYS
Een aanta lcomponenten hebben een property `vip_key`
Deze hebben de waardes:
- Payment (vaak)

#### In APV blok 1
- Inlogmiddel
- kvk
- initiator_is_contact
- name

- Email met de volgende variaties:
  - "vip_key": "email",
  - "oz_name": "email_adres",
  - "oz_api": "zaakeigenschappen"

- telefoon met de volgende variaties
  - "vip_key": "phone",
  - "oz_api": "zaakeigenschappen",
  - "oz_name": "telefoonnummer"

#### In APV blok 2
- inlogmiddel
- kvk
- initiator_is_contact
- name
- email
- phone

### Overig
Een keer het veld vipFormUuid
Een keer het veld initiatorTypeJz4All
jz4all_key": "is_authorized_person
jz4all_key": "webform_initiator.type




# Woweb openformulieren koppeling


## CSV data submission
Submission
```csv
Formuliernaam, Inzendingdatum, authBsn, authKvk, formulierData, bijlagen, appId, networkshare, formconfig
ESB Registratie, 2025-04-01 08:01:12.487800, 999992818, inhoud van veld, [], TDL, //karelstad/data/gemeenschappelijk/Webformulieren/Accp/TDL, {}
```

Bijlagen is een soort JSON object dat er zo uit ziet (let op enkele quotes) voor meerdere bijlagen:
```
[{'url': 'https://formulier.accp.nijmegen.nl/api/v2/submissions/files/89d3f6e1-d870-4815-99d0-d04116d6436a', 'data': {'url': 'https://formulier.accp.nijmegen.nl/api/v2/submissions/files/89d3f6e1-d870-4815-99d0-d04116d6436a', 'form': '', 'name': 'ad.svg', 'size': 272, 'baseUrl': 'https://formulier.accp.nijmegen.nl/api/v2/', 'project': ''}, 'name': 'ad-8e7b3aff-ef02-4187-9b1c-3937dd08b217.svg', 'size': 272, 'type': 'image/svg+xml', 'storage': 'url', 'originalName': 'ad.svg'}]
```

## JSON data submission in objecten API
```json
{
  "bsn": "999999333",
  "kvk": "",
  "pdf": "https://mijn-services.accp.nijmegen.nl/open-zaak/documenten/api/v1/enkelvoudiginformatieobjecten/a00f581a-0aa3-4f34-b983-70ecc36f5476",
  "data": {
    "inzending": {
      "authBsn": "999999333",
      "authKvk": "",
      "bijlagen": [],
      "formulierData": "test veld inhoud"
    }
  },
  "type": "ESB route test formulier",
  "AppId": "TDL",
  "reference": "OF-TLSCBK",
  "attachments": [],
  "networkshare": "//karelstad/data/gemeenschappelijk/Webformulieren/Accp/TDL"
}
```