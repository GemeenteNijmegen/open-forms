import { z } from 'zod';

/**
 * Schema based on the objecttype defined and used
 * as a basis for the open forms registration.
 */
export const SubmissionSchema = z.object({
  bsn: z.string().optional().nullable(),
  kvk: z.string().optional().nullable(),
  pdf: z.string(),
  formName: z.string(),
  reference: z.string(),
  attachments: z.array(z.string()),
  networkShare: z.string().optional(),
  submissionValuesToFiles: z.record(z.string(), z.string()).optional(),
});

export type Submission = z.infer<typeof SubmissionSchema>;
