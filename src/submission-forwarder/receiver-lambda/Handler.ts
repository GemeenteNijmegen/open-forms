

import { Logger } from '@aws-lambda-powertools/logger';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V1/Response';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ParseError, SendMessageError } from './ErrorTypes';
import { NotificationEventParser } from './NotificationEventParser';
import { Submission, SubmissionSchema } from '../shared/Submission';
import { trace } from '../shared/trace';
import { ZgwClientFactory } from '../shared/ZgwClientFactory';

const HANDLER_ID = 'receiver';
const logger = new Logger();
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
      const notification = NotificationEventParser.parse(event, logger);
      logger.debug('Parsed notification', { notification });

      // Handle test notifications
      if (notification.kanaal == 'test') {
        logger.info('Test notificatie ontvangen');
        return Response.json({ message: 'OK - test event' });
      }

      if (notification.resource == 'object') {
        // Get the object from the object api
        const objectClient = await this.options.zgwClientFactory.getObjectsApiClient();
        const object = await objectClient.getObject(notification.resourceUrl);

        const submission = SubmissionSchema.parse(object.record.data);
        logger.debug('Retreived submisison', { submission });

        await this.startExecution(submission);
        await trace(submission.reference, HANDLER_ID, 'OK');
        return Response.ok();
      }
      logger.warn('Unknown notification type');
      return Response.error(422, 'Unknown notification type, cannot process');
    } catch (error: unknown) {
      if (error instanceof ParseError) {
        return Response.error(400, error.message);
      }
      if (error instanceof SendMessageError) {
        return Response.error(502, error.message);
      }
      logger.error('Could not process notification', { error });
      let message;
      if (error instanceof Error) {
        message = error.message;
      }
      return Response.error(500, message);
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


