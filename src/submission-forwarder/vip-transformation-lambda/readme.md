# VIP & JZ4ALL Transformation Lambda

The examples provide the old and new submission messages.
The submission always contains a `Message` with a stringified json object, which contains all form values.


### VIP components
* Identify all form definition components with a vip_key or jz4all_key property (vip components)
* The key of those components have to be excatly the same in the submission message

For example:

formdefinition part of a component
``` 
{
    "key": "telefoonnummer",
    "properties": {
        "jz4all_key": "phone"
    },
}
```

means the submission in data has to have (value does not matter):
```
"telefoonnummer": "061234567890"
```
The level of nesting does not matter


### Zaaktype

The new submission should have the correct zaaktype in its data object.
`"vipZaaktype": "7562e893-3d95-4114-bceb-b3407346e4ff",`
Even JZ4ALL has a `vipZaaktype`.

### BSN and KvkNummer



### Example bezwaar maken definition fields needed

Als alle velden gefilterd worden op vip_key of jz4all_key dan levert het dit lijstje op in bezwaar maken.

```
{
  "isgemachtigde": "",
  "isgemachtigde1": "",
  "inlogmiddel": "",
  "opWelkeDatumHeeftDeGemeenteHetBesluitBekendGemaaktOfDeBeschikkingGegeven": "",
  "welkKenmerkOfReferentienummerHeeftHetBesluitOfDeBeschikkingWaartegenUBezwaarMaakt": "",
  "naam": "",
  "adres": "",
  "kvKNummer": "",
  "contactpersoon": "",
  "naamContactpersoon": "",
  "eMailadres": "",
  "telefoonnummer": "",
  "eMailadres1": ""
}
```

### Attributes

APV
APV-Taak
APV-Betaling
JUR
JUR-Betaling


### VIP keys en zaaktypen ophalen met testen
In de testmap staan een aantal testen die werken met bestanden die niet meegecommit zijn.
- Haal alle formdefinitions uit de formdefinitions backup bucket
- Zet in de map src/submission-forwarder/vip-transformation-lambda/test/excludedformdefinitions
- Pas de BESTANDSNAAM aan in de test naar keuze
- Check of de test niet disabled is: `xtest`. Haal de x weg. // TODO: misschien describe integration
- Draai de test