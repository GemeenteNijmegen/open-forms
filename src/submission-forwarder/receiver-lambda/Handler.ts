import { Logger } from '@aws-lambda-powertools/logger';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V1/Response';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ZodError } from 'zod';
import { InvalidStateError, ParseError, SendMessageError, UnknownObjectError } from './ErrorTypes';
import { NotificationEventParser } from './NotificationEventParser';
import { ObjectParser } from './ObjectParser';
import { logReceiverEvent } from './ReceiverLogging';
import { StepFunction } from './StepFunction';
import { SubmissionLogEvent } from '../../shared/submission-logging/SubmissionLogging';
import { EnrichedZgwObjectData } from '../shared/EnrichedZgwObjectData';
import { Notification } from '../shared/Notification';
import { trace } from '../shared/trace';
import { ZgwClientFactory } from '../shared/ZgwClientFactory';
import { ObjectSchema, ZgwObject } from '../shared/ZgwObject';

const HANDLER_ID = 'receiver';

interface ReceiverHandlerOptions {
  logger: Logger;
  zgwClientFactory: ZgwClientFactory;
  topicArn: string;
  orchestratorArn: string;
  supportedObjectTypes: string;
}

export class ReceiverHandler {
  private objectParser: ObjectParser;
  private stepFunction: StepFunction;
  private logger: Logger;

  constructor(private readonly options: ReceiverHandlerOptions) {
    this.logger = options.logger;
    this.objectParser = new ObjectParser(options.supportedObjectTypes);
    this.stepFunction = new StepFunction(this.options.orchestratorArn, { logger: this.logger });
  }

  async handle(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const logger = this.logger;
    try {
      const notification = NotificationEventParser.parse(event, logger);
      logger.debug('Parsed notification', { notification });

      // Handle test notifications
      if (notification.kanaal == 'test') {
        logger.info('Test notificatie ontvangen');
        return Response.json({ message: 'OK - test event' });
      }

      if (notification.resource == 'object') {
        logReceiverEvent(logger, SubmissionLogEvent.OBJECT_FETCH_STARTED, { notification });

        const zgwObject = await this.fetchObject(logger, notification);
        logReceiverEvent(logger, SubmissionLogEvent.OBJECT_FETCH_SUCCEEDED, { notification, zgwObject });

        try {
          const enrichedObject = this.objectParser.parse(zgwObject);
          logger.debug('Retrieved object', { result: enrichedObject });
          logReceiverEvent(logger, SubmissionLogEvent.OBJECT_PARSED, { notification, zgwObject, enrichedObject });

          logReceiverEvent(logger, SubmissionLogEvent.EXECUTION_STARTING, { notification, zgwObject, enrichedObject });
          const executionArn = await this.startExecution(logger, notification, zgwObject, enrichedObject);
          logReceiverEvent(logger, SubmissionLogEvent.EXECUTION_STARTED, {
            notification, zgwObject, enrichedObject, executionArn,
          });

          await trace(enrichedObject.reference, HANDLER_ID, 'OK');
          return Response.ok();
        } catch (err) {
          if (err instanceof UnknownObjectError) {
            logger.info('Not a recognized object type.', err.message);
            logReceiverEvent(logger, SubmissionLogEvent.OBJECT_IGNORED, { notification, zgwObject, error: err });
            return Response.ok();
          } else if (err instanceof InvalidStateError) {
            logger.info('Object not in a valid state for processing.', err.message);
            logReceiverEvent(logger, SubmissionLogEvent.OBJECT_IGNORED, { notification, zgwObject, error: err });
            return Response.ok();
          } else if (err instanceof ZodError) {
            logger.info('Received data failed schema validation', { error: err });
            logReceiverEvent(logger, SubmissionLogEvent.OBJECT_PARSE_FAILED, { notification, zgwObject, error: err });
            return Response.error(400, 'Received data failed schema validation');
          } else {
            throw err;
          }
        }
      }

      logger.warn('Unknown notification type');
      return Response.error(422, 'Unknown notification type, cannot process');
    } catch (error: unknown) {
      if (error instanceof ParseError) {
        return Response.error(400, error.message);
      }
      if (error instanceof ZodError) {
        logger.info('Received data failed schema validation', { error });
        return Response.error(400, 'Received data failed schema validation');
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

  private async fetchObject(logger: Logger, notification: Notification): Promise<ZgwObject> {
    try {
      const objectClient = await this.options.zgwClientFactory.getObjectsApiClient();
      const zgwObjectResponse = await objectClient.getObject(notification.resourceUrl);
      logger.debug(zgwObjectResponse);
      return ObjectSchema.parse(zgwObjectResponse);
    } catch (error) {
      logReceiverEvent(logger, SubmissionLogEvent.OBJECT_FETCH_FAILED, { notification, error });
      throw error;
    }
  }

  private async startExecution(
    logger: Logger,
    notification: Notification,
    zgwObject: ZgwObject,
    enrichedObject: EnrichedZgwObjectData,
  ): Promise<string | undefined> {
    try {
      return await this.stepFunction.startExecution(enrichedObject);
    } catch (error) {
      logReceiverEvent(logger, SubmissionLogEvent.EXECUTION_START_FAILED, {
        notification, zgwObject, enrichedObject, error,
      });
      throw error;
    }
  }
}
