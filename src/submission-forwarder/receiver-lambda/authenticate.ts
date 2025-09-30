import { AWS, environmentVariables } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ALLOWED_HEADERS = [
  'X-Authorization',
  'X-Authorization',
  'Authorization',
  'authorization',
  'x-api-key',
];

let API_KEY: string | undefined = undefined;
export async function authenticate(event: APIGatewayProxyEvent) {
  if (!API_KEY) {
    const env = environmentVariables(['API_KEY_ARN']);
    API_KEY = await AWS.getSecret(env.API_KEY_ARN);
  }

  if (!API_KEY) {
    throw new Error('API_KEY was not loaded, is API_KEY_ARN env variable set?');
  }

  if (!event.headers) {
    throw new Error('No headers avaialble to check for API key');
  }

  const usedHeader = ALLOWED_HEADERS.find(h => event.headers[h] != undefined);
  if (!usedHeader) {
    throw new Error('No headers available to check for API key');
  }

  const header = event.headers[usedHeader];

  if (!header) {
    throw new Error('No Authorization header found in the request.');
  }

  if (!header.startsWith('Token ')) {
    throw new Error('Authorization header must have a token prefix');
  }

  if (header.substring('Token '.length) === API_KEY) {
    return true;
  }

  throw new Error('Invalid API Key');
}