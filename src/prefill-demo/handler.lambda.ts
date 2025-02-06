import { randomUUID } from 'crypto';
import { ApiGatewayV2Response } from '@gemeentenijmegen/apigateway-http';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

export async function handler(_event: APIGatewayProxyEventV2): Promise<ApiGatewayV2Response> {
  return {
    body: JSON.stringify({
      value: randomUUID(),
    }),
    statusCode: 200,
  };
}