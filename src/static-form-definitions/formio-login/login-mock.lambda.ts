import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export async function handler(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return {
    body: '{}',
    statusCode: 200,
    headers: {
      'x-jwt-token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    },
  };
}