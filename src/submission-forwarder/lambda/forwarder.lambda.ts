import { Logger } from '@aws-lambda-powertools/logger';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SubmissionForwarderHandler } from './Handler';
import { ZgwClientFactory } from './ZgwClientFactory';

const logger = new Logger();

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  logger.debug('event', { event });

  const env = environmentVariables([
    'DOCUMENTEN_BASE_URL',
    'DOCUMENTEN_CLIENT_ID_SSM',
    'DOCUMENTEN_CLIENT_SECRET_ARN',
    'OBJECTS_API_APIKEY_ARN',
    'SUBMISSION_BUCKET_NAME',
  ]);

  const submissionForwarderHandler = new SubmissionForwarderHandler({
    zgwClientFactory: new ZgwClientFactory({
      clientIdSsm: env.DOCUMENTEN_CLIENT_ID_SSM,
      clientSecretArn: env.DOCUMENTEN_CLIENT_SECRET_ARN,
      objectsApikeyArn: env.OBJECTS_API_APIKEY_ARN,
    }),
    documentenBaseUrl: env.DOCUMENTEN_BASE_URL,
    bucketName: env.SUBMISSION_BUCKET_NAME,
  });
  return submissionForwarderHandler.handle(event);

}