import { Logger } from '@aws-lambda-powertools/logger';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { SubmissionForwarderHandler } from './Handler';
import { ZgwClientFactory } from './ZgwClientFactory';

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

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  logger.debug('event', { event });

  const submissionForwarderHandler = new SubmissionForwarderHandler({
    zgwClientFactory: getZgwClientFactory(),
    documentenBaseUrl: env.DOCUMENTEN_BASE_URL,
    zakenBaseUrl: env.ZAKEN_BASE_URL,
    catalogiBaseUrl: env.CATALOGI_BASE_URL,
    bucketName: env.SUBMISSION_BUCKET_NAME,
    queueUrl: env.QUEUE_URL,
  });

  const batchItemFailures: SQSBatchItemFailure[] = [];
  for (const record of event.Records) {
    try {
      await submissionForwarderHandler.handle(record);
    } catch (error) {
      logger.error('Failed to forward a submission', { data: record.messageId, error });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };

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