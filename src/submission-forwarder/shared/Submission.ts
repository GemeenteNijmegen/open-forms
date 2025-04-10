import { z } from 'zod';

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
  submissionValuesToFiles: z.record(z.string(), z.string()).optional(),
});

export type Submission = z.infer<typeof SubmissionSchema>;
