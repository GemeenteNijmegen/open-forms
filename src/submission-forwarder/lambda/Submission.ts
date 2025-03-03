import { z } from 'zod';

/**
 * Schema based on the objecttype defined and used
 * as a basis for the open forms registration.
 */
export const SubmissionSchema = z.object({
  bsn: z.string().optional(),
  kvk: z.string().optional(),
  pdf: z.string(),
  type: z.string(),
  reference: z.string(),
  attachments: z.array(z.string()),
});

export type Submission = z.infer<typeof SubmissionSchema>;
