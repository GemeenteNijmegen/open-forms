import { Logger } from '@aws-lambda-powertools/logger';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { MockVIPHandler } from './MockVIPHandler';

const logger = new Logger();
const env = environmentVariables(['TOPIC_ARN']);
const sns = new SNSClient({});
export async function handler(rawEvent: any) {
  logger.debug('event', { rawEvent });

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
