import { z } from 'zod';

/**
 * Schema based on the message format aggreed up on
 * with the ESB
 */
export const EsbSubmissionSchema = z.object({
  targetNetworkLocation: z.string(),
  folderName: z.string(),
  s3Files: z.array(z.string()).min(1),
});

export type EsbSubmission = z.infer<typeof EsbSubmissionSchema>;
