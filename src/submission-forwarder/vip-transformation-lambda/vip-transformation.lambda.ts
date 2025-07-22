import { randomUUID } from 'crypto';
import { Logger } from '@aws-lambda-powertools/logger';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { MockVIPHandler } from './MockVIPHandler';
import { PaymentSnsMessage } from './PaymentMessage';
import { zaaktypeConfig } from './VipZaakTypeConfig';
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
  await handelRealEvents(rawEvent);
}


async function handelRealEvents(stepfunctionInput: any) {
  logger.debug('Not implemented yet...');
  const event = VIPJZSubmissionSchema.parse(stepfunctionInput.enrichedObject);

  // Obtain zaaktype config
  const thisZaaktypeConfig = zaaktypeConfig.find(config => config.zaaktypeVariable == event.vipZaakTypeVariable);
  if (!thisZaaktypeConfig) {
    throw Error('Could not find zaaktype configuration for: ' + event.vipZaakTypeVariable);
  }

  const submissionSnsMessage = {
    // Move these field to the root level of the submission.
    bsn: event.bsn,
    kvknummer: event.kvk,
    reference: event.reference,
    appId: thisZaaktypeConfig.appId,
    // Move all otherfields to the submission's data field
    data: {
      ...event,
      payment: undefined, // Send in separate message
      internalNotificationEmails: undefined, // No need to pass this to vip/jz4all
      vipZaaktype: isProduction ? thisZaaktypeConfig.prodUUID : thisZaaktypeConfig.accUUID,
      // Other fields are all part of the event and depdend on the form
    },
    // All file info is moved to this field
    fileObjects: stepfunctionInput.fileObjects,
  };

  logger.debug('Sending submission to woweb sns topic', { submissionSnsMessage });

  // extract payment event and send that to the topic as well
  if (event.payment) {
    if (!event.payment.payment_amount) {
      throw Error('Cannot handle incomplete payments: missing amount.');
    }
    const message: PaymentSnsMessage = {
      amount: event.payment.payment_amount,
      appId: `${thisZaaktypeConfig.appId}-Betaling`,
      formTitle: thisZaaktypeConfig.formName,
      reference: event.reference,
      uuid: randomUUID(), // Just use a random uuid we have the reference to correlate.
    };
    logger.debug('Sending payment message to woweb sns topic', { message });
  }

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