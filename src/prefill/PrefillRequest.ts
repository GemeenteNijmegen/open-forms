import { z } from 'zod';

/**
 * This interface describes the JSON format of the incomming
 * prefill request from the container.
 */
export const PrefillRequestSchema = z.object({
  formName: z.string(),
  authenticationType: z.enum(['irma', 'eherkenning', 'digid']),
  identification: z.array(
    z.object({
      attributeType: z.string(),
      value: z.preprocess(
        (arg) => {
          if (typeof arg === 'string') return arg;
          if (arg != null && (typeof arg === 'number' || typeof arg === 'boolean')) {
            return String(arg);
          }
          // For objects, arrays, null or undefined, return an empty string.
          return '';
        },
        z.string(),
      ),
    }),
  ),
});


export type PrefillRequest = z.infer<typeof PrefillRequestSchema>;
