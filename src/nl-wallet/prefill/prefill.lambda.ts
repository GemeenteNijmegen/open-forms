import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response } from '@gemeentenijmegen/apigateway-http';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

const db = new DynamoDBClient();

export async function handler(event: APIGatewayProxyEventV2, _context: any): Promise<ApiGatewayV2Response> {

  // Parse event
  const sub = event.queryStringParameters?.sub;
  const claim = event.queryStringParameters?.claim;
  if (!sub || !claim) {
    return {
      statusCode: 400,
    };
  }

  // Get the claims from the dynamodb table
  const item = await db.send(new GetItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: {
      sub: { S: sub },
    },
  }));

  // Get the specific claim from the stored claims and return it
  const claimsStr = item.Item?.claims.S;
  if (claimsStr) {
    const claims = JSON.parse(claimsStr);
    const result = claims[claim];
    if (result) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          value: result,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };
    }
  }

  return {
    statusCode: 400,
    body: JSON.stringify({ msg: 'Could not parse claims or find the requested claim' }),
    headers: {
      'Content-Type': 'application/json',
    },
  };


}