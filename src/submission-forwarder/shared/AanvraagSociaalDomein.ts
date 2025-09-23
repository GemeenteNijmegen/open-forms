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
  EMailAdresClient: z.string().email().optional(),
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
  EMailAdresClient: z.string().email().optional(),
  relatie: RelatieSchema.optional(),
});

export const AanvraagSociaalDomeinSchema = z.object({
  sociaalDomeinRegeling: z.string(),
  zaaktypeIdentificatie: z.string(),
  aardVerzoek: z.string().optional(),
  datumAanvraag: z.string().optional(),
  datumStartAanvraag: z.string().optional(),
  indBestaandeKlant: z.string().optional(),
  bsn: z.string().optional(),
  kvk: z.string().optional(),
  bsnNamens: z.string().optional(),
  kvkNamens: z.string().optional(),
  inlogmiddel: z.string().optional(),
  pdf: z.string(),
  formName: z.string(),
  reference: z.string(),
  attachments: z.array(z.string()),
  aanvragerGegevens: z.object({
    email: z.string().optional(),
    telefoonnummer: z.string().optional(),
    volledigeNaam: z.string().optional(),
    leeftijd: z.string().optional(),
    geboorteDatum: z.string().optional(),
    rni: z.string().optional(),
    geboorteDatumNietStandaard: z.boolean().optional(),
    bewindvoering: z.boolean().optional(),
  }).optional(),
  client: ClientSchema.optional(),
}).passthrough();

export type AanvraagSociaalDomein = z.infer<typeof AanvraagSociaalDomeinSchema>;
