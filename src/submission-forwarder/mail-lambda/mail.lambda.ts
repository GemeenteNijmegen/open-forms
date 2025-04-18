import { Logger } from '@aws-lambda-powertools/logger';
import { SNSEvent } from 'aws-lambda';

const logger = new Logger();

export async function handler(event: SNSEvent) {
  logger.debug('Received event', { event });
  logger.debug('TODO implement mail');
}