import { Logger } from '@aws-lambda-powertools/logger';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { SNSEvent } from 'aws-lambda';
import { SubmissionForwarderHandler } from './Handler';
import { SubmissionSchema } from '../shared/Submission';
import { ZgwClientFactory } from '../shared/ZgwClientFactory';

const logger = new Logger();

let clientFactory: ZgwClientFactory | undefined = undefined;
const env = environmentVariables([
  'DOCUMENTEN_BASE_URL',
  'ZAKEN_BASE_URL',
  'CATALOGI_BASE_URL',
  'MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM',
  'MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN',
  'OBJECTS_API_APIKEY_ARN',
  'SUBMISSION_BUCKET_NAME',
  'QUEUE_URL',
]);

export async function handler(event: any) {
  logger.debug('event', { event });

  const submissionForwarderHandler = new SubmissionForwarderHandler({
    zgwClientFactory: getZgwClientFactory(),
    documentenBaseUrl: env.DOCUMENTEN_BASE_URL,
    zakenBaseUrl: env.ZAKEN_BASE_URL,
    catalogiBaseUrl: env.CATALOGI_BASE_URL,
    bucketName: env.SUBMISSION_BUCKET_NAME,
    queueUrl: env.QUEUE_URL,
  });

  // Check if it has a reference and a formName -> Its a direct submission object
  if (event.reference && event.formName) {
    const submission = SubmissionSchema.parse(event);
    await submissionForwarderHandler.handle(submission);
  }

  // Keeping it backwards compatible while introducing the stepfunction
  // If it has records its an SNS event
  if (event.Records) {
    await handleSnsEvent(submissionForwarderHandler, event as SNSEvent);
  }

}

async function handleSnsEvent(submissionForwarderHandler: SubmissionForwarderHandler, event: SNSEvent) {
  let failed = false;
  for (const record of event.Records) {
    try {
      const submission = SubmissionSchema.parse(JSON.parse(record.Sns.Message));
      await submissionForwarderHandler.handle(submission);
    } catch (error) {
      logger.error('Failed to forward a submission', { data: record.Sns.MessageId, error });
      failed = true;
    }
  }

  if (failed) {
    throw Error('Failed to process SNS event');
  }
}

function getZgwClientFactory() {
  if (!clientFactory) {
    clientFactory = new ZgwClientFactory({
      clientIdSsm: env.MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM,
      clientSecretArn: env.MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN,
      objectsApikeyArn: env.OBJECTS_API_APIKEY_ARN,
    });
  }
  return clientFactory;
}