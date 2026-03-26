import { randomUUID } from 'crypto';
import { ApiGatewayV2Response } from '@gemeentenijmegen/apigateway-http';

export async function handler(): Promise<ApiGatewayV2Response> {
  return {
    body: JSON.stringify({
      value: randomUUID(),
    }),
    statusCode: 200,
  };
}