export interface ZaaktypeConfig {
  zaaktypeVariable: string;
  formName: string;
  option: string;
  accUUID: string | null;
  prodUUID: string | null;
  appId: string;
}

export const zaaktypeConfig: ZaaktypeConfig[] = [
  // beheerderExploitatievergunningHorecaZonderAlcoholAanpassen
  {
    zaaktypeVariable: 'beheerderHorecaZonderAlcoholAanpassenSeks',
    formName: 'beheerderExploitatievergunningHorecaZonderAlcoholAanpassen',
    option: 'seksbedrijf',
    accUUID: '78c8112f-8ab9-4803-80ff-efa7391e930a',
    prodUUID: '78c8112f-8ab9-4803-80ff-efa7391e930a',
    appId: 'APV',
  },
  {
    zaaktypeVariable: 'beheerderHorecaZonderAlcoholAanpassenDefault',
    formName: 'beheerderExploitatievergunningHorecaZonderAlcoholAanpassen',
    option: 'droge horeca en coffeeshops',
    accUUID: '13480658-02f9-4339-b91c-89a55d51e518',
    prodUUID: '13480658-02f9-4339-b91c-89a55d51e518',
    appId: 'APV',
  },

  // terrasvergunningAanvragenOfAanpassen
  {
    zaaktypeVariable: 'terrasVergunningDefault',
    formName: 'terrasvergunningAanvragenOfAanpassen',
    option: '',
    accUUID: 'ad3f54c1-23f9-4c75-a3ba-062177507775',
    prodUUID: 'ad3f54c1-23f9-4c75-a3ba-062177507775',
    appId: 'APV',
  },

  // toestemmingVragenTijdelijkAlcoholSchenken
  {
    zaaktypeVariable: 'toestemmingTijdelijkAlcoholSchenken',
    formName: 'toestemmingVragenTijdelijkAlcoholSchenken',
    option: '',
    accUUID: '2c86b174-fe1a-45dc-a57d-3f7b5ff4ad2e',
    prodUUID: '2c86b174-fe1a-45dc-a57d-3f7b5ff4ad2e',
    appId: 'APV',
  },

  // leidinggevendeAlcoholvergunningAanpassen
  {
    zaaktypeVariable: 'leidingAlcoholVergunningAanpassen',
    formName: 'leidinggevendeAlcoholvergunningAanpassen',
    option: '',
    accUUID: '5a7611c0-607b-4c4a-a1be-fcd9d7929be1',
    prodUUID: '5a7611c0-607b-4c4a-a1be-fcd9d7929be1',
    appId: 'APV',
  },

  // exploitatievergunningAanvragen
  {
    zaaktypeVariable: 'exploitatieVergunningAanvragen',
    formName: 'exploitatievergunningAanvragen',
    option: '',
    accUUID: '43d2464d-697c-44af-86cb-343ca2cb435b',
    prodUUID: '43d2464d-697c-44af-86cb-343ca2cb435b',
    appId: 'APV',
  },

  // objectvergunningAanvragenNew
  {
    zaaktypeVariable: 'objectVergunningAanvragen',
    formName: 'objectvergunningAanvragenNew',
    option: '',
    accUUID: '443c6ca1-bb3e-45d3-8099-2415567579da',
    prodUUID: '443c6ca1-bb3e-45d3-8099-2415567579da',
    appId: 'APV',
  },

  // alcoholvergunningAanvragen
  {
    zaaktypeVariable: 'alcoholVergunningAanvragen',
    formName: 'alcoholvergunningAanvragen',
    option: '',
    accUUID: '77275f3c-18f8-4756-b478-2f4d4289edc5',
    prodUUID: '77275f3c-18f8-4756-b478-2f4d4289edc5',
    appId: 'APV',
  },

  // kansspelautomaatAanwezigheidsvergunningAanvragen
  {
    zaaktypeVariable: 'kansspelAutomaatAanwezigheid',
    formName: 'kansspelautomaatAanwezigheidsvergunningAanvragen',
    option: '',
    accUUID: '37b6abd2-0f82-4ac2-b8c7-581488417729',
    prodUUID: '37b6abd2-0f82-4ac2-b8c7-581488417729',
    appId: 'APV',
  },

  // bezwaarMaken
  // In oude omgeving heet dit formulier bezwaarmakenNieuw op prod
  {
    zaaktypeVariable: 'bezwaarMaken',
    formName: 'bezwaarMaken',
    option: '',
    accUUID: '7562e893-3d95-4114-bceb-b3407346e4ff',
    prodUUID: '7562e893-3d95-4114-bceb-b3407346e4ff',
    appId: 'JUR',
  },

  // evenementMeldenOfVergunningAanvragen
  // Oude omgeving bestaat voetbal nog niet op acceptatie
  {
    zaaktypeVariable: 'evenementMeldenVoetbal',
    formName: 'evenementenMeldenOfVergunningAanvragen',
    option: 'voetbal soortevenement',
    accUUID: 'fc669b32-7f54-49e7-a452-9b6340bd1524',
    prodUUID: 'fc669b32-7f54-49e7-a452-9b6340bd1524',
    appId: 'APV',
  },
  {
    zaaktypeVariable: 'evenementMeldenNeeRegels',
    formName: 'evenementenMeldenOfVergunningAanvragen',
    option: 'nee bij regelsbootfeest regelsevenement of regelsopenbareruimte',
    accUUID: '8fbd51c8-6cf8-4fad-863e-900ace122dc3',
    prodUUID: '8fbd51c8-6cf8-4fad-863e-900ace122dc3',
    appId: 'APV',
  },
  {
    zaaktypeVariable: 'evenementMeldenDefault',
    formName: 'evenementenMeldenOfVergunningAanvragen',
    option: 'default optie als de anderen het niet zijn',
    accUUID: '707d70e2-5a4c-4e8d-9930-0562ade8cf80',
    prodUUID: '707d70e2-5a4c-4e8d-9930-0562ade8cf80',
    appId: 'APV',
  },

  // klachtOverDeGemeenteDoorgeven
  // Lijkt dubbel met klachtOverIetsAnders en dit is de nieuwste
  {
    zaaktypeVariable: 'klachtGemeenteDoorgeven',
    formName: 'klachtOverDeGemeenteDoorgevenNieuw',
    option: '',
    accUUID: 'd459c41b-0aa7-48cf-8d11-b1d78e17e803',
    prodUUID: 'd459c41b-0aa7-48cf-8d11-b1d78e17e803',
    appId: 'JUR',
  },

  // klachtOverIetsAnders
  // Dit is vermoedelijk oud, maar vo0or nu even laten staan, toch zelfde uuid
  {
    zaaktypeVariable: 'klachtIetsAnders',
    formName: 'klachtOverIetsAndersNieuw',
    option: '',
    accUUID: 'd459c41b-0aa7-48cf-8d11-b1d78e17e803',
    prodUUID: 'd459c41b-0aa7-48cf-8d11-b1d78e17e803',
    appId: 'JUR',
  },

  // standplaatsAanvragenOfAanpassen
  {
    zaaktypeVariable: 'standplaatsGemeentegrond',
    formName: 'standplaatsAanvragenOfAanpassen',
    option: 'gemeentegrond',
    accUUID: '86bcbd30-4578-4bd0-bf8b-1c4137929c43',
    prodUUID: '86bcbd30-4578-4bd0-bf8b-1c4137929c43',
    appId: 'APV',
  },
  {
    zaaktypeVariable: 'standplaatsPriveterrein',
    formName: 'standplaatsAanvragenOfAanpassen',
    option: 'priveterrein',
    accUUID: 'd5b9bbaa-8ec6-4a96-9da5-1a625fb1ba18',
    prodUUID: 'd5b9bbaa-8ec6-4a96-9da5-1a625fb1ba18',
    appId: 'APV',
  },
  {
    zaaktypeVariable: 'standplaatsWinter',
    formName: 'standplaatsAanvragenOfAanpassen',
    option: 'winterseizoen',
    accUUID: '58073376-8064-4ccf-9211-022fa1bae97a',
    prodUUID: '58073376-8064-4ccf-9211-022fa1bae97a',
    appId: 'APV',
  },
  {
    zaaktypeVariable: 'standplaatsKoningsdag',
    formName: 'standplaatsAanvragenOfAanpassen',
    option: 'koningsdag',
    accUUID: 'dc23085b-9a3a-4623-9d83-346ec60e44ca',
    prodUUID: 'dc23085b-9a3a-4623-9d83-346ec60e44ca',
    appId: 'APV',
  },
  {
    zaaktypeVariable: 'standplaatsConcerten',
    formName: 'standplaatsAanvragenOfAanpassen',
    option: 'concerten',
    accUUID: 'f096043c-c6bc-4823-8b37-8ec565d3d862',
    prodUUID: 'f096043c-c6bc-4823-8b37-8ec565d3d862',
    appId: 'APV',
  },
  {
    zaaktypeVariable: 'standplaatsVervanger',
    formName: 'standplaatsAanvragenOfAanpassen',
    option: 'vervanger',
    accUUID: 'f6920155-9d7d-461c-b1f8-23271b826c62',
    prodUUID: 'f6920155-9d7d-461c-b1f8-23271b826c62',
    appId: 'APV',
  },
  {
    zaaktypeVariable: 'standplaatsAanpassen',
    formName: 'standplaatsAanvragenOfAanpassen',
    option: 'aanpassen',
    accUUID: '181ade64-1eac-4d69-8703-bc9b882edc10',
    prodUUID: '181ade64-1eac-4d69-8703-bc9b882edc10',
    appId: 'APV',
  },


  // ontheffingOpeningstijdenWinkelAanvragen
  {
    zaaktypeVariable: 'openingstijdenOntheffing',
    formName: 'ontheffingOpeningstijdenWinkelAanvragen',
    option: '',
    accUUID: '7c5edc47-f282-48c6-936b-882db2ec597b',
    prodUUID: '7c5edc47-f282-48c6-936b-882db2ec597b',
    appId: 'APV',
  },

  // marktplaatsvergunningAanvragenOfAanpassen
  // In de oude omgeving komen acc en prod hier niet overeen. In acc is hier alles de default
  {
    zaaktypeVariable: 'marktplaatsAanpassen',
    formName: 'marktplaatsvergunningAanvragenOfAanpassen',
    option: 'aanpassen',
    accUUID: '905ccaf0-a86e-4d39-9066-5e738f38e542',
    prodUUID: '905ccaf0-a86e-4d39-9066-5e738f38e542',
    appId: 'APV',
  },
  {
    zaaktypeVariable: 'marktplaatsVervanger',
    formName: 'marktplaatsvergunningAanvragenOfAanpassen',
    option: 'vervanger',
    accUUID: '905ccaf0-a86e-4d39-9066-5e738f38e542',
    prodUUID: '905ccaf0-a86e-4d39-9066-5e738f38e542',
    appId: 'APV',
  },
  {
    zaaktypeVariable: 'marktplaatsDefault',
    formName: 'marktplaatsvergunningAanvragenOfAanpassen',
    option: 'default als er geen vervanger of aanpassen keuze is gemaakt',
    accUUID: 'aa228ec6-1e68-48f4-b3e9-00ae53be271d',
    prodUUID: 'aa228ec6-1e68-48f4-b3e9-00ae53be271d',
    appId: 'APV',
  },

  // informatiekraamMeldenOfVergunningAanvragen
  {
    zaaktypeVariable: 'informatiekraamMelden',
    formName: 'informatiekraamMeldenOfVergunningAanvragen',
    option: '',
    accUUID: '88405356-c2b2-4c8a-b00b-458ce41ea75d',
    prodUUID: '88405356-c2b2-4c8a-b00b-458ce41ea75d',
    appId: 'APV',
  },

  // datumReserverenEvenement
  {
    zaaktypeVariable: 'datumReserverenEvenement',
    formName: 'datumReserverenEvenementNew1',
    option: '',
    accUUID: '4b9e8c14-6054-40ad-b768-09c8e70c7268',
    prodUUID: '4b9e8c14-6054-40ad-b768-09c8e70c7268',
    appId: 'APV',
  },

  // bingoMeldenOfLoterijvergunningAanvragen
  {
    zaaktypeVariable: 'bingoBingoKienen',
    formName: 'bingoMeldenOfLoterijvergunningAanvragen',
    option: 'bingoOfKienenOfRadVanAvontuur',
    accUUID: '4953995e-c108-428b-b9ea-9e2c7012d796',
    prodUUID: '4953995e-c108-428b-b9ea-9e2c7012d796',
    appId: 'APV',
  },
  {
    zaaktypeVariable: 'bingoDefault',
    formName: 'bingoMeldenOfLoterijvergunningAanvragen',
    option: 'default in dit geval alleen loterij',
    accUUID: '1471ea69-be57-449b-a240-2d07c86f943f',
    prodUUID: '1471ea69-be57-449b-a240-2d07c86f943f',
    appId: 'APV',
  },

  // vergunningAanvragenKraamPodiumLangsRouteVierdaagse
  {
    zaaktypeVariable: 'kraamPodiumVierdaagse',
    formName: 'vergunningAanvragenKraamPodiumLangsRouteVierdaagse',
    option: '',
    accUUID: '2ebd0651-2b40-4cc5-a5f9-a278ab1c076c',
    prodUUID: '2ebd0651-2b40-4cc5-a5f9-a278ab1c076c',
    appId: 'APV',
  },

  // toestemmingVervoerGevaarlijkeStoffenAanvragen (voorheen apvOntheffingVervoerGevaarlijkeStoffenAanvragen)
  {
    zaaktypeVariable: 'toestemmingVervoerGevaarlijk',
    formName: 'toestemmingVervoerGevaarlijkeStoffenAanvragen',
    option: '',
    accUUID: '8ecf8631-4ff6-4c8e-8d95-65b83035e7b2',
    prodUUID: '8ecf8631-4ff6-4c8e-8d95-65b83035e7b2',
    appId: 'APV',
  },

  // themamarktVergunningAanvragen
  {
    zaaktypeVariable: 'themamarktVergunning',
    formName: 'themamarktVergunningAanvragen',
    option: '',
    accUUID: '4e16c53a-2650-4861-91ef-c9f005bc0235',
    prodUUID: '4e16c53a-2650-4861-91ef-c9f005bc0235',
    appId: 'APV',
  },
];
