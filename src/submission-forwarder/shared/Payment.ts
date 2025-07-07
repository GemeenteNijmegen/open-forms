import z from 'zod';

// Possible payment properties from Open Forms
// For now all optional to test the objecttype

export const PaymentSchema = z
  .object({
    payment_completed: z.boolean().optional(),
    payment_amount: z.number().optional().nullable(),
    payment_public_order_ids: z.array(z.string()).optional(),
    provider_payment_ids: z.array(z.string()).optional(),
  })
  .optional()
  .nullable();


export type Payment = z.infer<typeof PaymentSchema>;