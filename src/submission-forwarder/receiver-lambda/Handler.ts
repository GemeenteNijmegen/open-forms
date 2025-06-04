

import { Logger } from '@aws-lambda-powertools/logger';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V1/Response';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ParseError, SendMessageError } from './ErrorTypes';
import { NotificationEventParser } from './NotificationEventParser';
import { ObjectParser, objectParserResult } from './ObjectParser';
import { trace } from '../shared/trace';
import { ZgwClientFactory } from '../shared/ZgwClientFactory';
import { ObjectSchema } from '../shared/ZgwObject';

const HANDLER_ID = 'receiver';
const logger = new Logger();
const stepfunctions = new SFNClient();

interface ReceiverHandlerOptions {
  zgwClientFactory: ZgwClientFactory;
  topicArn: string;
  orchestratorArn: string;
  supportedObjectTypes: string;
}


export class ReceiverHandler {
  private objectParser: ObjectParser;

  constructor(private readonly options: ReceiverHandlerOptions) {
    this.objectParser = new ObjectParser(options.supportedObjectTypes);
  }

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
        const zgwObjectResponse = await objectClient.getObject(notification.resourceUrl);
        logger.debug(zgwObjectResponse);
        const zgwObject = ObjectSchema.parse(zgwObjectResponse);
        const result = this.objectParser.parse(zgwObject);
        // const submission = SubmissionSchema.parse(object.record.data);
        logger.debug('Retrieved object', { result });

        await this.startExecution(result);
        await trace(result.reference, HANDLER_ID, 'OK');
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


  async startExecution(result: objectParserResult) {
    const execution = await stepfunctions.send(new StartExecutionCommand({
      stateMachineArn: this.options.orchestratorArn,
      input: JSON.stringify(result),
      name: `${result.reference}-${Date.now()}`,
    }));
    logger.info('Started orchestrator', { executionArn: execution.executionArn });
  }

}


