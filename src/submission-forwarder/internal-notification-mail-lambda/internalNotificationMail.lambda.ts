import { Logger } from '@aws-lambda-powertools/logger';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { Submission, SubmissionSchema } from '../shared/Submission';
import { trace } from '../shared/trace';

const HANDLER_ID = 'NOTIFICATION_MAIL';
const logger = new Logger();
const ses = new SESClient();
const mailFromDomain = process.env.MAIL_FROM_DOMAIN!;

export async function handler(event: any) {
  logger.debug('Received event', { event });

  const submission = SubmissionSchema.parse(event);
  try {
    await sendNotificationMail(submission);
    await trace(submission.reference, HANDLER_ID, 'OK');
  } catch (error) {
    logger.error('failed to send notificaiton mail', { error });
    await trace(submission?.reference ?? 'unknown', HANDLER_ID, 'FAILED');
  }
}

async function sendNotificationMail(submission: Submission) {

  if (!submission.internalNotificationEmails) {
    throw Error('No recipients set');
  }

  await ses.send(new SendEmailCommand({
    Message: {
      Subject: {
        Data: `Aanvraag ${submission.formName} met kenmerk ${submission.reference}`,
      },
      Body: {
        Text: {
          Data: constructNotificationEmail(submission),
        },
      },
    },
    Destination: {
      ToAddresses: submission.internalNotificationEmails,
    },
    Source: `notificatie@${mailFromDomain}`,
  }));
}

function constructNotificationEmail(submission: Submission) {
  return [
    `Er is een nieuwe aanvraag ${submission.formName} binnengekomen met kenmerk ${submission.reference}`,
    'U kunt de aanvraag op de volgende locaties terugvinden:',
    replaceForwardSlashes(submission.networkShare),
    replaceForwardSlashes(submission.monitoringNetworkShare),
  ].join('\n');
}

/**
 * @param stringToTransform
 * @returns string without forward slashes, only backslashes
 */
export function replaceForwardSlashes(stringToTransform: string | undefined | null): string {
  if (!stringToTransform) {
    return '';
  }
  if (stringToTransform.includes('/')) {
    return stringToTransform.replace(/\//g, '\\');
  }
  return stringToTransform;
}
