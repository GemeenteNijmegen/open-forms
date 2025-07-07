import z from 'zod';

export const EnrichedZgwObjectDataSchema= z.object({
  pdf: z.string(),
  attachments: z.array(z.string()),
  reference: z.string(),
  objectUrl: z.string(),
  s3SubFolder: z.string().optional().describe('Submission with a specific subfolder location in the submissionbucket. e.g. vip or jz4all'),
}).passthrough();

export type EnrichedZgwObjectData = z.infer<typeof EnrichedZgwObjectDataSchema>;
