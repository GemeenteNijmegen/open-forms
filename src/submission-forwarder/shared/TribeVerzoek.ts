import { z } from 'zod';
import { KeyValuePairSchema } from './Submission';

/**
 * Manually derived from src/submission-forwarder/schema/TribeVerzoek.json. Keep both in sync.
 * Autodelen fields are deliberately free strings without an enum and accept
 * empty/null; unknown properties are kept (.passthrough()).
 */
export const AutodelenSchema = z.object({
  voornaam: z.string().optional().nullable(),
  tussenvoegsel: z.string().optional().nullable(),
  achternaam: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  emailadres: z.string().optional().nullable(),
  telefoonnummer: z.string().optional().nullable(),
  situatie: z.string().optional().nullable(),
  toelichtingSituatie: z.string().optional().nullable(),
  hoeGevonden: z.string().optional().nullable(),
  toelichtingHoeGevonden: z.string().optional().nullable(),
  contactMetAnderen: z.string().optional().nullable(),
  andereOpmerkingen: z.string().optional().nullable(),
  contactVoorkeur: z.string().optional().nullable(),
}).passthrough();
export type Autodelen = z.infer<typeof AutodelenSchema>;

const text = z.string().optional().nullable();
const textOrNumber = z.union([z.string(), z.number()]).optional().nullable();
const number = z.number().optional().nullable();
const booleanOrText = z.union([z.boolean(), z.string()]).optional().nullable();
const checkboxes = z.record(z.string(), z.boolean()).optional().nullable();

const EnergieloketAdresSchema = z.object({
  postcode: text,
  huisnummer: textOrNumber,
  huisnummertoevoeging: text,
  straatnaam: text,
  woonplaats: text,
}).passthrough();

/**
 * Manually derived from the energieloket block in src/submission-forwarder/schema/TribeVerzoek.json. Keep both in sync.
 * Like Autodelen: every field optional and nullable, choices are free strings without an enum, unknown properties are kept.
 */
export const EnergieloketSchema = z.object({
  aanvrager: z.object({
    naam: text,
    voornaam: text,
    tussenvoegsel: text,
    achternaam: text,
    emailadres: text,
    telefoonnummer: text,
    contactVoorkeur: text,
    adres: EnergieloketAdresSchema.optional().nullable(),
  }).passthrough().optional().nullable(),
  adres: EnergieloketAdresSchema.optional().nullable(),
  woning: z.object({
    soort: text,
    bouwjaar: textOrNumber,
    eigenaarBewoner: booleanOrText,
    gasverbruikM3: number,
    elektriciteitsverbruikKWh: number,
    verwarming: text,
    verwarmingAnders: text,
    verwarmingLeeftijd: textOrNumber,
    verwarmingJaar: textOrNumber,
    ventilatie: text,
    ventilatieAnders: text,
    verbeteringenGedaan: checkboxes,
    verbeteringenGedaanAnders: text,
    wensen: checkboxes,
    wensenAnders: text,
    energielabel: text,
    monument: booleanOrText,
    buurt: text,
    slechtGeisoleerdeBouwdelen: checkboxes,
  }).passthrough().optional().nullable(),
  vve: z.object({
    naam: text,
    adressen: z.array(z.object({ straatnaam: text, huisnummers: text }).passthrough()).optional().nullable(),
    aantalWoningen: number,
    soortWoningen: text,
    soortWoningenAnders: text,
    bouwjaar: textOrNumber,
    huurwoningen: text,
    verhoudingEigendom: text,
    percentageEigenaarBewoners: number,
    soortVerhuur: checkboxes,
    hoofdEnOndersplitsing: text,
    andereFuncties: text,
    jaarSplitsingsakte: textOrNumber,
    mjop: text,
    duurzaamheidscommissie: text,
    verbeteringenGedaan: checkboxes,
    verbeteringenGedaanAnders: text,
    verbeteringenGewenst: text,
    wensen: checkboxes,
    splitsingsakteToegevoegd: z.boolean().optional().nullable(),
    mjopToegevoegd: z.boolean().optional().nullable(),
    contactpersonen: z.array(z.object({
      naam: text,
      voornaam: text,
      tussenvoegsel: text,
      achternaam: text,
      emailadres: text,
      telefoonnummer: text,
    }).passthrough()).optional().nullable(),
  }).passthrough().optional().nullable(),
  bekendheid: z.object({
    kanalen: checkboxes,
    anders: text,
    krantOfWijkblad: text,
    website: text,
    socialeMedia: text,
    actie: text,
    nieuwsbrief: text,
  }).passthrough().optional().nullable(),
  afspraak: z.object({
    huisbezoekGewenst: booleanOrText,
    opmerkingen: text,
  }).passthrough().optional().nullable(),
}).passthrough();
export type Energieloket = z.infer<typeof EnergieloketSchema>;

export const TribeVerzoekSchema = z.object({
  tribeEnvironment: z.string(),
  tribeSubmissionType: z.string(),
  bsn: z.string().optional().nullable(),
  kvk: z.string().optional().nullable(),
  pdf: z.string(),
  csv: z.string().optional().nullable(),
  formName: z.string().optional().nullable(),
  formEnvironment: z.string().optional().nullable(),
  reference: z.string(),
  attachments: z.array(z.string()),
  networkShare: z.string().optional().nullable(),
  monitoringNetworkShare: z.string().optional().nullable(),
  internalNotificationEmails: z.array(z.string()).optional().nullable(),
  submissionValuesToFiles: z
    .union([
      z.array(KeyValuePairSchema).optional(),
      z.null(),
    ])
    .optional(),
  bsnOrKvkToFile: z.boolean().optional().nullable(),
  autodelen: AutodelenSchema.optional(),
  energieloket: EnergieloketSchema.optional(),
}).passthrough();

export type TribeVerzoek = z.infer<typeof TribeVerzoekSchema>;
