import z from 'zod';

export const EsfTaakSchema = z.object({
  soort: z.literal('formtaak'),
  titel: z.string(),
  status: z.enum(['open', 'afgerond', 'verwerkt', 'gesloten']),
  eigenaar: z.string(),
  formtaak: z.object({
    formulier: z.object({
      soort: z.literal('url'),
      value: z.string().url(),
    }),
    data: z.object({
      clientnummer: z.string(),
      termijnvanordedatum: z.string(),
      inkhef: z.string(),
      dossiernummer: z.string(),
      regelingnummer: z.string(),
      periodenummer: z.string(),
      /**
       * Do not validate on email here as prefill data is very untrustowthy.
       */
      email: z.string(),
      telefoon: z.string().optional(),
    }).passthrough(),
    verzonden_data: z.object({
      formulierreferentie: z.string(),
      /**
       * Do validate here as this is enforced by open-forms.
       */
      email: z.string().email(),
      telefoon: z.string(),
      inkomstengewijzigd: z.string(),
      woonsituatiegewijzigd: z.string(),
      vakantiegewijzigd: z.string(),
      studiegewijzigd: z.string(),
      vrijwilligerswerkgewijzigd: z.string(),
      vermogengewijzigd: z.string(),
      toelichtingingevuld: z.string(),
      pdf: z.string(),
      attachments: z.array(z.string()),
    }),
  }),
  verloopdatum: z.string(),
  identificatie: z.object({
    type: z.enum(['bsn', 'kvk']),
    value: z.string(),
  }),
}).passthrough();

export type EsfTaak = z.infer<typeof EsfTaakSchema>;
