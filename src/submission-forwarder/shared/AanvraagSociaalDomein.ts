import { z } from 'zod';

const AdresSchema = z.object({
  Straatnaam: z.string().optional(),
  Huisnummer: z.string().optional(),
  Postcode: z.string().optional(),
  Woonplaatsnaam: z.string().optional(),
  Gemeentenaam: z.string().optional(),
}).partial();

const NationaliteitSchema = z.object({
  CdNationaliteit: z.string().optional(),
}).partial();

const TelefoonSchema = z.object({
  Netnr: z.string().optional(),
  Abonneenr: z.string().optional(),
  TypeTelefoonnr: z.string().optional(),
}).partial();

const PartnerSchema = z.object({
  BurgerServiceNr: z.string().optional(),
  Voornamen: z.string().optional(),
  Voorletters: z.string().optional(),
  Voorvoegsel: z.string().optional(),
  Achternaam: z.string(),
  AanduidingNaamgebruik: z.string().optional(),
  Geslacht: z.string(),
  Geboortedatum: z.string().optional(),
  CdFictieveGeboortedat: z.string().optional(),
  Correspondentieadres: AdresSchema.optional(),
  Feitelijkadres: AdresSchema.optional(),
  Nationaliteit: NationaliteitSchema.optional(),
  Iban: z.string().optional(),
  Telefoonnr: TelefoonSchema.optional(),
  EMailAdresClient: z.string().optional(),
});

const RelatieSchema = z.object({
  SoortRelatie: z.string().optional(),
  Begindatum: z.string().optional(),
  CdFictieveBegindat: z.string().optional(),
  Partner: PartnerSchema.optional(),
}).partial();

const ClientSchema = z.object({
  BurgerServiceNr: z.string().optional(),
  Voornamen: z.string().optional(),
  Voorletters: z.string().optional(),
  Voorvoegsel: z.string().optional(),
  Achternaam: z.string(),
  AanduidingNaamgebruik: z.string().optional(),
  Geslacht: z.string(),
  Geboortedatum: z.string().optional(),
  CdFictieveGeboortedat: z.string().optional(),
  Correspondentieadres: AdresSchema.optional(),
  Feitelijkadres: AdresSchema.optional(),
  Nationaliteit: NationaliteitSchema.optional(),
  Iban: z.string().optional(),
  Telefoonnr: TelefoonSchema.optional(),
  EMailAdresClient: z.string().optional(),
  relatie: RelatieSchema.optional(),
});


const AanvragerAdresSchema = z.object({
  straatnaam: z.string().optional(),
  huisnummerVolledig: z.string().optional(),
  huisnummer: z.union([z.string(), z.number()]).optional(),
  huisletter: z.string().optional(),
  huisnummertoevoeging: z.string().optional(),
  postcode: z.string().optional(),
  woonplaats: z.string().optional(),
  gemeente: z.string().optional(),
  postbus: z.union([z.string(), z.number()]).optional(),
}).passthrough();


const BewijzenSchema = z.union([
  z.null(),
  z.record(z.unknown()),
  z.array(z.unknown()),
]);


const CosignerSchema = z.object({
  cosign_data: z.record(z.unknown()).optional(),
  cosign_date: z.string().optional(),
  cosign_bsn: z.string().optional(),
  cosign_kvk: z.string().optional(),
  cosign_pseudo: z.string().optional(),
  cosignType: z.string().optional(),
  volledigeNaam: z.string().optional(),
  voornaam: z.string().optional(),
  tussenvoegsel: z.string().optional(),
  achternaam: z.string().optional(),
  initialen: z.string().optional(),
  geboorteDatum: z.string().optional(),
  email: z.string().optional(),
  telefoonnummer: z.string().optional(),
}).passthrough();


export const AanvragerGegevensSchema = z.object({
  email: z.string().optional(),
  telefoonnummer: z.string().optional(),
  volledigeNaam: z.string().optional(),
  leeftijd: z.string().optional(),
  geboorteDatum: z.string().optional(),
  rni: z.string().optional(),
  geboorteDatumNietStandaard: z.boolean().optional(),
  bewindvoering: z.boolean().optional(),
  adres: AanvragerAdresSchema.optional(),
  bewijzen: BewijzenSchema.optional(),
  cosigner: CosignerSchema.optional(),
}).passthrough();

export type AanvragerGegevens = z.infer<typeof AanvragerGegevensSchema>;


export const AanvraagSociaalDomeinSchema = z.object({
  // Verplichte velden
  sociaalDomeinRegeling: z.string(),
  zaaktypeIdentificatie: z.string(),
  pdf: z.string(),
  formName: z.string(),
  reference: z.string(),
  attachments: z.array(z.string()),

  // Optionele velden
  aardVerzoek: z.string().optional(),
  datumAanvraag: z.string().optional(),
  datumStartAanvraag: z.string().optional(),
  indBestaandeKlant: z.string().optional(),
  bsn: z.string().optional(),
  kvk: z.string().optional(),
  bsnNamens: z.string().optional(),
  kvkNamens: z.string().optional(),
  inlogmiddel: z.string().optional(),
  csv: z.string().optional(),
  networkShare: z.string().optional(),
  monitoringNetworkShare: z.string().optional().nullable(),
  internalNotificationEmails: z.array(z.string()).optional().nullable(),
  bsnOrKvkToFile: z.boolean().optional().nullable(),
  client: ClientSchema.optional(),
  aanvragerGegevens: AanvragerGegevensSchema.optional(),

}).passthrough();

export type AanvraagSociaalDomein = z.infer<typeof AanvraagSociaalDomeinSchema>;