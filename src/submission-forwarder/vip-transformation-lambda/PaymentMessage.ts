
import z from 'zod';

export const PaymentSnsMessageSchema = z.object({
  uuid: z.string(),
  appId: z.string(),
  reference: z.string(),
  formTitle: z.string(),
  amount: z.number(),
  // Part of original payment message but i dont think it does anything
  // "validTill": [2025, 1, 30, 6, 24, 48, 693252353],
  // "type": "form",
  // "secured": true
});

export type PaymentSnsMessage = z.infer<typeof PaymentSnsMessageSchema>;
