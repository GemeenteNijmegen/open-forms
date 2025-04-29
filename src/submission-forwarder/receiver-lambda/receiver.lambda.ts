import { Logger } from '@aws-lambda-powertools/logger';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { authenticate } from './authenticate';
import { ReceiverHandler } from './Handler';
import { ZgwClientFactory } from '../shared/ZgwClientFactory';

const logger = new Logger();

let clientFactory: ZgwClientFactory | undefined = undefined;

const env = environmentVariables([
  'MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM',
  'MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN',
  'OBJECTS_API_APIKEY_ARN',
  'TOPIC_ARN',
  'ORCHESTRATOR_ARN',
]);

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

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  logger.debug('event', { event });

  await authenticate(event);

  const receiverHandler = new ReceiverHandler({
    zgwClientFactory: getZgwClientFactory(),
    topicArn: env.TOPIC_ARN,
    orchestratorArn: env.ORCHESTRATOR_ARN,
  });

  try {
    return await receiverHandler.handle(event);
  } catch (error) {
    logger.error('Could not process notification', { error });
    return response({ message: 'error.message' }, 500);
  }

}

/**
 * Construct a simple response for the API Gateway to return
 * @param body
 * @param statusCode
 * @returns
 */
function response(body?: any, statusCode: number = 200): APIGatewayProxyResult {
  return {
    statusCode,
    body: JSON.stringify(body) ?? '{}',
    headers: {
      'Content-Type': 'application/json',
    },
  };
}
