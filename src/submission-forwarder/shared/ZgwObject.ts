import z from 'zod';

export const ObjectSchema = z.object({
  type: z.string().url(),
  url: z.string().url(),
  uuid: z.string().uuid(),
  record: z.object({
    index: z.number().optional(),
    data: z.object({}).passthrough(),
  }).passthrough(),
});

export type ZgwObject = z.infer<typeof ObjectSchema>;
