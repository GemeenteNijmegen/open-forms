import { Logger } from '@aws-lambda-powertools/logger';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { ParseError } from './ErrorTypes';
import { logReceiverEvent } from './ReceiverLogging';
import { SubmissionLogEvent } from '../../shared/submission-logging/SubmissionLogging';
import { Notification, NotificationSchema } from '../shared/Notification';

export class NotificationEventParser {
  /**
   * Parses the event and constructs a Notification
   * @param event
   * @returns
   */
  static parse(event: APIGatewayProxyEvent, logger?: Logger): Notification {
    logger = logger ?? new Logger();
    try {
      if (!event.body) {
        throw Error('No body found in event');
      }
      let body = event.body;
      if (event.isBase64Encoded) {
        body = Buffer.from(event.body, 'base64').toString('utf-8');
      }
      const bodyJson = JSON.parse(body);
      const notification = NotificationSchema.parse(bodyJson);
      logReceiverEvent(logger, SubmissionLogEvent.NOTIFICATION_RECEIVED, { notification });
      return notification;
    } catch (error) {
      logger.error('Could not parse notification', { error });
      logReceiverEvent(logger, SubmissionLogEvent.NOTIFICATION_PARSE_FAILED, { error });
      throw new ParseError('Failed to parse notification');
    }
  }
}
