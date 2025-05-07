import { z } from 'zod';


export const KeyValuePairSchema = z.tuple([z.string(), z.union([z.string(), z.number()])]);
export type KeyValuePair = z.infer<typeof KeyValuePairSchema>;

/**
 * Schema based on the objecttype defined and used
 * as a basis for the open forms registration.
 * Future improvement option is to use the Objecttype netwerkschijfESBFormulierInzending to generate
 */
export const SubmissionSchema = z.object({
  bsn: z.string().optional().nullable(),
  kvk: z.string().optional().nullable(),
  pdf: z.string(),
  formName: z.string(),
  reference: z.string(),
  attachments: z.array(z.string()),
  networkShare: z.string().optional(),
  monitoringNetworkShare: z.string().optional().nullable(),
  internalNotificationEmails: z.array(z.string()).optional().nullable(),
  submissionValuesToFiles: z
    .union([
      z.array(KeyValuePairSchema).optional(), // This ensures an array of key-value tuples.
      z.null(),
    ]).optional(),
  bsnOrKvkToFile: z.boolean().optional().nullable(),
});

export type Submission = z.infer<typeof SubmissionSchema>;
