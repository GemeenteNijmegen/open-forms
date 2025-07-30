import z from 'zod';

/**
 * Schema and type of expected input for Internal Notification Mail lambda handler
 *
 * All fields needed to send internal notifications e-mails with sufficient information
 */
export const InternalNotificationMailSubmissionSchema = z.object({
  internalNotificationEmails: z.array(z.string()).optional().nullable(),
  formName: z.string(),
  reference: z.string(),
  networkShare: z.string().optional(),
  monitoringNetworkShare: z.string().optional().nullable(),
}).passthrough();

export type InternalNotificationMailSubmission = z.infer<typeof InternalNotificationMailSubmissionSchema>;