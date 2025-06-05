import z from 'zod';

export const EnrichedZgwObjectDataSchema= z.object({
  pdf: z.string(),
  attachments: z.array(z.string()),
  reference: z.string(),
  objectUrl: z.string(),
}).passthrough();

export type EnrichedZgwObjectData = z.infer<typeof EnrichedZgwObjectDataSchema>;
