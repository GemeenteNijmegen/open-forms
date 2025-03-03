import { Logger } from '@aws-lambda-powertools/logger';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { authenticate } from './authenticate';

const logger = new Logger();

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  logger.debug(JSON.stringify(event));

  await authenticate(event);



  return {
    statusCode: 200,
    body: '',
  };
}