import { Logger } from '@aws-lambda-powertools/logger';
import { AWS } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { authenticate } from './authenticate';
import { Notification, NotificationSchema } from './Notification';
import { ObjectsApiClient } from './ObjectsApiClient';

const logger = new Logger();

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  logger.debug('event', { event });

  await authenticate(event);

  const notification = getNotification(event);
  logger.debug('Parsed notification', { notification });

  // Handle test notifications
  if (notification.kanaal == 'test') {
    logger.info('Test notificatie ontvangen');
    return response({ message: 'OK - test event' });
  }

  // Get the object from the object api
  const objectClient = await getObjectsApiClient();
  const object = objectClient.getObject(notification.resourceUrl);
  logger.debug('Retreived object', { object });


  // TODO Collect de documents from the document API and forward those to the target S3 bucket

  // TODO Construct a nice SQS message to send to the ESB

  return response({ message: 'OK' });
}

let objectsApiClient: undefined | ObjectsApiClient = undefined;
async function getObjectsApiClient() {
  if (!objectsApiClient) {
    objectsApiClient = new ObjectsApiClient({
      apikey: await AWS.getSecret(process.env.OBJECTS_API_APIKEY_ARN!),
    })
  }
  return objectsApiClient;
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


/**
 * Parses the event and constructs a Notification
 * @param event
 * @returns
 */
function getNotification(event: APIGatewayProxyEvent): Notification {
  if (!event.body) {
    throw Error('No body found in event');
  }
  let body = event.body;
  if (event.isBase64Encoded) {
    body = Buffer.from(event.body, 'base64').toString('utf-8');
  }
  const bodyJson = JSON.parse(body);
  return NotificationSchema.parse(bodyJson);
}