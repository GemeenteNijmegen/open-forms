import z from 'zod';

/**
 * Schema and type of expected input for zgw-registration-function
 *
 * All fields needed to create a zaak and link the documents from pdf and attachments to the zaak
 * zaaktypeIdentificatie defaults to OF-INZENDING if not passed
 * bsn or kvk trigger making a role
 * partner also has to be added here as an optional mede-initiator rol
 */
export const ZGWRegistrationSubmissionSchema = z.object({
  bsn: z.string().optional().nullable(),
  kvk: z.string().optional().nullable(),
  zaaktypeIdentificatie: z
    .preprocess((val) => (val == null ? 'OF-INZENDING' : val), z.string()),
  // Default makes sure it is backwards compatible
  // And the type is always defined and not null
  pdf: z.string(),
  formName: z.string(),
  reference: z.string(),
  attachments: z.array(z.string()),
}).passthrough();

export type ZGWRegistrationSubmission = z.infer<typeof ZGWRegistrationSubmissionSchema>;