import { z } from 'zod';
import { KeyValuePairSchema } from './Submission';

/**
 * Manually derived from src/submission-forwarder/tribe/schema/TribeVerzoek.json (stap 1.2). Keep both in sync.
 * Autodelenvelden zijn bewust vrije strings zonder enum (architectuur §4.4) en
 * accepteren leeg/null; onbekende properties blijven behouden (.passthrough()).
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
}).passthrough();
export type Autodelen = z.infer<typeof AutodelenSchema>;

/**
 * Placeholder voor toekomstige Energieloket-velden (architectuur §1, §15).
 * Nog geen deelschema; blijft vrij totdat het eerste Energieloket-submissiontype wordt gebouwd.
 */
export const EnergieloketSchema = z.object({}).passthrough();
export type Energieloket = z.infer<typeof EnergieloketSchema>;

export const TribeVerzoekSchema = z.object({
  tribeEnvironment: z.string(),
  tribeSubmissionType: z.string(),
  bsn: z.string().optional().nullable(),
  kvk: z.string().optional().nullable(),
  pdf: z.string(),
  csv: z.string().optional().nullable(),
  formName: z.string().optional().nullable(),
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
