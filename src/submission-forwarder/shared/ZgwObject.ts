import z from 'zod';

export const ObjectSchema = z.object({
  type: z.string().url(),
  record: z.object({
    data: z.object({}).passthrough(),
  }).passthrough(),
});

export type ZgwObject = z.infer<typeof ObjectSchema>;
