

import { Logger } from '@aws-lambda-powertools/logger';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { MessageAttributeValue } from '@aws-sdk/client-sqs';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Notification, NotificationSchema } from '../shared/Notification';
import { Submission, SubmissionSchema } from '../shared/Submission';
import { trace } from '../shared/trace';
import { ZgwClientFactory } from '../shared/ZgwClientFactory';

const HANDLER_ID = 'receiver';
const logger = new Logger();
const sns = new SNSClient();
const stepfunctions = new SFNClient();

interface ReceiverHandlerOptions {
  zgwClientFactory: ZgwClientFactory;
  topicArn: string;
  orchestratorArn: string;
}

export class ReceiverHandler {


  constructor(private readonly options: ReceiverHandlerOptions) { }

  async handle(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {

    try {
      const notification = this.getNotification(event);
      logger.debug('Parsed notification', { notification });

      // Handle test notifications
      if (notification.kanaal == 'test') {
        logger.info('Test notificatie ontvangen');
        return this.response({ message: 'OK - test event' });
      }

      // Get the object from the object api
      const objectClient = await this.options.zgwClientFactory.getObjectsApiClient();
      const object = await objectClient.getObject(notification.resourceUrl);
      const submission = SubmissionSchema.parse(object.record.data);
      logger.debug('Retreived submisison', { submission });

      // Figure out attributes to send to topic
      const attributes: Record<string, MessageAttributeValue> = {
        reference: { DataType: 'String', StringValue: submission.reference },
        internalNotificationEmails: { DataType: 'String', StringValue: 'false' },
        networkShare: { DataType: 'String', StringValue: 'false' },
        resubmit: { DataType: 'String', StringValue: 'false' },
      };
      if (submission.networkShare || submission.monitoringNetworkShare) {
        attributes.networkShare.StringValue = 'true';
      }
      if (submission.internalNotificationEmails) {
        attributes.internalNotificationEmails.StringValue = 'true';
      }

      await this.startExecution(submission);
      await this.sendNotificationToTopic(this.options.topicArn, submission, attributes);

      await trace(submission.reference, HANDLER_ID, 'OK');
      return this.response({ message: 'OK' });

    } catch (error) {
      if (error instanceof ParseError) {
        return this.response({ message: error.message }, 400);
      }
      if (error instanceof SendMessageError) {
        return this.response({ message: error.message }, 502);
      }
      logger.error('Could not process notification', { error });
      return this.response({ message: 'error.message' }, 500);
    }

  }

  /**
   * Construct a simple response for the API Gateway to return
   * @param body
   * @param statusCode
   * @returns
   */
  response(body?: any, statusCode: number = 200): APIGatewayProxyResult {
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
  getNotification(event: APIGatewayProxyEvent): Notification {
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

  async sendNotificationToTopic(topicArn: string, submission: Submission, attributes: Record<string, MessageAttributeValue>) {
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

  async startExecution(submission: Submission) {
    const execution = await stepfunctions.send(new StartExecutionCommand({
      stateMachineArn: this.options.orchestratorArn,
      input: JSON.stringify(submission),
      name: `${submission.reference}-${Date.now()}`,
    }));
    logger.info('Started orchestrator', { executionArn: execution.executionArn });
  }

}

export class ParseError extends Error { }
export class SendMessageError extends Error { }