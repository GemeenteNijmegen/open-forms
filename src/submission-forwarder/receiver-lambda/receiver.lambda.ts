import { Logger } from '@aws-lambda-powertools/logger';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { MessageAttributeValue } from '@aws-sdk/client-sqs';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ZgwClientFactory } from '../forwarder-lambda/ZgwClientFactory';
import { Notification, NotificationSchema } from '../shared/Notification';
import { Submission, SubmissionSchema } from '../shared/Submission';
import { trace } from '../shared/trace';
import { authenticate } from './authenticate';

const HANDLER_ID = 'receiver';
const logger = new Logger();
const sns = new SNSClient();

let clientFactory: ZgwClientFactory | undefined = undefined;

const env = environmentVariables([
  'MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM',
  'MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN',
  'OBJECTS_API_APIKEY_ARN',
  'TOPIC_ARN',
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

  try {
    const notification = getNotification(event);
    logger.debug('Parsed notification', { notification });

    // Handle test notifications
    if (notification.kanaal == 'test') {
      logger.info('Test notificatie ontvangen');
      return response({ message: 'OK - test event' });
    }

    // Get the object from the object api
    const zgwClientFactory = getZgwClientFactory();
    const objectClient = await zgwClientFactory.getObjectsApiClient();
    const object = await objectClient.getObject(notification.resourceUrl);
    const submission = SubmissionSchema.parse(object.record.data);
    logger.debug('Retreived submisison', { submission });

    // Figure out attributes to send to topic
    const attributes: Record<string, MessageAttributeValue> = {
      internalNotificationEmails: { DataType: 'String', StringValue: 'false' },
      networkShare: { DataType: 'String', StringValue: 'false' },
    };
    if (submission.networkShare || submission.monitoringNetworkShare) {
      attributes.networkShare.StringValue = 'true';
    }
    if (submission.internalNotificationEmails) {
      attributes.internalNotificationEmails.StringValue = 'true';
    }

    // Send object incl. tags to SNS
    await sendNotificationToTopic(env.TOPIC_ARN, object, attributes);
    await trace(submission.reference, HANDLER_ID, true);
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

async function sendNotificationToTopic(topicArn: string, submission: Submission, attributes: Record<string, MessageAttributeValue>) {
  try {
    await sns.send(new PublishCommand({
      Message: JSON.stringify(submission),
      MessageAttributes: attributes,
      TopicArn: topicArn,
    }));
  } catch (error) {
    logger.error('Could not send submission to topic', { error });
    throw new SendMessageError('Failed to send submission to topic');
  }
}

class ParseError extends Error { }
class SendMessageError extends Error { }