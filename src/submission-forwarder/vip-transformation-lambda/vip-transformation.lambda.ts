import { randomUUID } from 'crypto';
import { Logger } from '@aws-lambda-powertools/logger';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { MockVIPHandler } from './MockVIPHandler';
import { Transformator } from './Transformator';
import { VIPJZSubmissionSchema } from '../shared/VIPJZSubmission';

const logger = new Logger();
const env = environmentVariables(['TOPIC_ARN', 'IS_PRODUCTION']);
const sns = new SNSClient({});
const isProduction = env.IS_PRODUCTION === 'true';

export async function handler(rawEvent: any) {
  logger.debug('event', { rawEvent });

  // Check if the event is from the step function or a manual incovation...
  if (!rawEvent.enrichedObject) {
    await handleMock(rawEvent);
  }

  // Handle real events
  await handleRealEvents(rawEvent);
}


async function handleRealEvents(stepfunctionInput: any) {

  const transformator = new Transformator(isProduction);

  const fileObjects = stepfunctionInput.fileObjects;
  const formData = VIPJZSubmissionSchema.parse(stepfunctionInput.enrichedObject);
  const submissionUuid = randomUUID(); // Only used by vip/jz

  // Submission transformation
  const submissionSnsMessage = transformator.convertObjectToSnsSubmission(formData, fileObjects, submissionUuid);
  logger.debug('Sending submission to woweb sns topic', { submissionSnsMessage });
  await publishOnSnsTopic(submissionSnsMessage);

  // extract payment event and send that to the topic as well (note payment fields are in object but are empty when no payment was present)
  const paymentSnsMessage = transformator.convertObjectToSnsPayment(formData, submissionUuid);
  if (!paymentSnsMessage) {
    logger.debug('No payment found in submission, not sending payment confirmation message.');
    return;
  }
  logger.debug('Sending payment message to woweb sns topic', { paymentSnsMessage });
  await publishOnSnsTopic(paymentSnsMessage);

}

async function publishOnSnsTopic(message: any) {
  const command = new PublishCommand({
    TopicArn: env.TOPIC_ARN,
    Message: JSON.stringify(message),
    MessageAttributes: {
      AppId: { DataType: 'String', StringValue: message.appId },
    },
  });
  await sns.send(command);
}


async function handleMock(rawEvent: any) {

  const event =
    typeof rawEvent.body === 'string' ? JSON.parse(rawEvent.body) : rawEvent;

  const choice = event.mockChoice ?? 'vip01';

  logger.info('Using mock choice and attribute', { choice });

  const { body, attribute } = new MockVIPHandler().handle(choice);
  const message = JSON.stringify(body);
  logger.info('Sns message', message);
  logger.info('Sending mock sns message', { choice, attribute, body });

  const cmd = new PublishCommand({
    TopicArn: env.TOPIC_ARN,
    Message: message,
    MessageAttributes: {
      AppId: { DataType: 'String', StringValue: attribute },
    },
  });
  try {
    logger.debug('Try publish SNS message');
    const publishSnsMessage = await sns.send(cmd);
    logger.info('Published message to SNS topic', {
      messageId: publishSnsMessage.MessageId,
    });
    return {
      statusCode: 200,
      body: JSON.stringify({ messageId: publishSnsMessage.MessageId }),
    };
  } catch (err) {
    logger.error('Failed to publish to SNS topic', { error: err });
    throw err;
  }
}