import { Logger } from '@aws-lambda-powertools/logger';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { authenticate } from './authenticate';
import { Notification, NotificationSchema } from '../shared/Notification';

const logger = new Logger();
const sqs = new SQSClient();

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  logger.debug('event', { event });

  const env = environmentVariables(['QUEUE_URL']);
  await authenticate(event);

  try {
    const notification = getNotification(event);

    // Handle test notifications
    if (notification.kanaal == 'test') {
      logger.info('Test notificatie ontvangen');
      return response({ message: 'OK - test event' });
    }

    // Send notification to sqs
    await sendNotificationToQueue(env.QUEUE_URL, notification);
    return response({ message: 'OK' });

  } catch (error) {
    if (error instanceof ParseError) {
      return response({ message: error.message }, 400);
    }
    if (error instanceof SendMessageError) {
      return response({ message: error.message }, 502);
    }
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

/**
 * Parses the event and constructs a Notification
 * @param event
 * @returns
 */
function getNotification(event: APIGatewayProxyEvent): Notification {
  try {
    if (!event.body) {
      throw Error('No body found in event');
    }
    let body = event.body;
    if (event.isBase64Encoded) {
      body = Buffer.from(event.body, 'base64').toString('utf-8');
    }
    const bodyJson = JSON.parse(body);
    return NotificationSchema.parse(bodyJson);
  } catch (error) {
    logger.error('Could not parse notification', { error });
    throw new ParseError('Failed to parse notification');
  }
}

async function sendNotificationToQueue(queueUrl: string, notification: Notification) {
  try {
    await sqs.send(new SendMessageCommand({
      MessageBody: JSON.stringify(notification),
      QueueUrl: queueUrl,
    }));
  } catch (error) {
    logger.error('Could not send notification to queue', { error });
    throw new SendMessageError('Failed to send notification to queue');
  }
}

class ParseError extends Error { }
class SendMessageError extends Error { }