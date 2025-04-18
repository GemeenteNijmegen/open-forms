import { Logger } from '@aws-lambda-powertools/logger';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { SNSEvent } from 'aws-lambda';
import { Submission, SubmissionSchema } from '../shared/Submission';
import { trace } from '../shared/trace';

const HANDLER_ID = 'NOTIFICATION_MAIL';
const logger = new Logger();
const ses = new SESClient();
const mailFromDomain = process.env.MAIL_FROM_DOMAIN!;

export async function handler(event: SNSEvent) {
  logger.debug('Received event', { event });
  const object = JSON.parse(event.Records[0].Sns.Message); // Can max be of length 1
  const submission = SubmissionSchema.parse(object);
  try {
    await sendNotificationMail(submission);
    await trace(submission.reference, HANDLER_ID, 'OK');
  } catch (error) {
    logger.error('failed to send notificaiton mail', { error });
    await trace(submission.reference, HANDLER_ID, 'FAILED');
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
    submission.networkShare ?? '',
    submission.monitoringNetworkShare ?? '',
  ].join('\n');
}