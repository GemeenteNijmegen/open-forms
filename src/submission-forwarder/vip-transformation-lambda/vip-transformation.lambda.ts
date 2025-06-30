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

  const choice = event.mockChoice ?? '01';
  const attribute = event.attribute ?? 'APV';

  logger.info('Using mock choice and attribute', { choice, attribute });

  const mockVIPHandler = new MockVIPHandler();
  const mockedMessageToPublish = mockVIPHandler.handle(event);
  const message = JSON.stringify(mockedMessageToPublish);

  const messageAttributes = {
    AppId: {
      DataType: 'String',
      StringValue: attribute,
    },
    MockChoice: {
      DataType: 'String',
      StringValue: choice,
    },
  };

  const cmd = new PublishCommand({
    TopicArn: env.TOPIC_ARN,
    Message: message,
    MessageAttributes: messageAttributes,
    // MessageAttributes here...
    // Does it still need AppId or BRP_data or KVK_data messageattributes
    // Check payment attributes as well
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
