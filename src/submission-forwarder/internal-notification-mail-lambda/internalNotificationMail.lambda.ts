import { Logger } from '@aws-lambda-powertools/logger';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { InternalNotificationMailSubmission, InternalNotificationMailSubmissionSchema } from './InternalNotificationMailSubmission';
import { trace } from '../shared/trace';
import { createFullNetworkPath } from '../utils/buildPath';

const HANDLER_ID = 'NOTIFICATION_MAIL';
const logger = new Logger();
const ses = new SESClient();
const mailFromDomain = process.env.MAIL_FROM_DOMAIN!;

export async function handler(event: any) {
  logger.debug('Received event', { event }); // Only log all data with debug

  const parsed = InternalNotificationMailSubmissionSchema.safeParse(
    event.enrichedObject ?? event,
  );
  if (!parsed.success) {
    const message = 'InternalNotificationMail failed to parse input object. Does not comply with zod InternalNotificationMailSubmissionSchema.';
    logger.error(message, { zodIssues: parsed.error.issues });
    throw new Error(message);
  }
  const submission: InternalNotificationMailSubmission = parsed.data;
  logger.appendKeys({ reference: submission.reference, formName: submission.formName });
  logger.info(
    `InternalNotificationMail start for ${event.enrichedObject ? 'enrichedObject' : 'plain submission'} ${submission.reference} type ${submission.formName}`,
  );

  try {
    await sendNotificationMail(submission);
    await trace(submission.reference, HANDLER_ID, 'OK');
  } catch (error) {
    logger.error('failed to send notification mail', { error });
    await trace(submission?.reference ?? 'unknown', HANDLER_ID, 'FAILED');
  }
  return event;
}

async function sendNotificationMail(submission: InternalNotificationMailSubmission) {

  if (!submission.internalNotificationEmails) {
    throw Error('No recipients set. InternalNotificationEmails should not be falsy (undefined, null, empty string).');
  }
  if (submission.internalNotificationEmails.length === 0) {
    logger.warn('No recipients set in internalNotificationEmails array. Array is empty, so no e-mail will be sent.');
  }

  await ses.send(new SendEmailCommand({
    Message: {
      Subject: {
        Data: `${submission.formName} met kenmerk ${submission.reference}`,
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

function constructNotificationEmail(submission: InternalNotificationMailSubmission) {
  return [
    `Er is een nieuwe aanvraag ${submission.formName} binnengekomen met kenmerk ${submission.reference}`,
    (submission.networkShare || submission.monitoringNetworkShare) && 'U kunt de aanvraag op de volgende locaties terugvinden:',
    submission.networkShare && createFullNetworkPath(submission.networkShare, submission.formName, submission.reference),
    submission.monitoringNetworkShare && createFullNetworkPath(submission.monitoringNetworkShare, submission.formName, submission.reference),
  ].join('\n');
}
