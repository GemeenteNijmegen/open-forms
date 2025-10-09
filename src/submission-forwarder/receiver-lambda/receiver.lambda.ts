import { Logger } from '@aws-lambda-powertools/logger';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V1/Response';
import { authenticate, environmentVariables } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ReceiverHandler } from './Handler';
import { ZgwClientFactory } from '../shared/ZgwClientFactory';

const logger = new Logger();

let clientFactory: ZgwClientFactory | undefined = undefined;

const env = environmentVariables([
  'MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM',
  'MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN',
  'OBJECTS_API_APIKEY_ARN',
  'ORCHESTRATOR_ARN',
  'SUPPORTED_OBJECTTYPES',
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

  try {
    await authenticate(event);
  } catch (error) {
    logger.error('Failed authentication', { error });
    return Response.error(401, 'Unauthorized');
  }

  const receiverHandler = new ReceiverHandler({
    zgwClientFactory: getZgwClientFactory(),
    topicArn: env.TOPIC_ARN,
    orchestratorArn: env.ORCHESTRATOR_ARN,
    supportedObjectTypes: env.SUPPORTED_OBJECTTYPES,
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
