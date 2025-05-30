import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { ApiGatewayV2Response } from '@gemeentenijmegen/apigateway-http';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import * as jose from 'jose';

const db = new DynamoDBClient();

export async function handler(event: APIGatewayProxyEventV2): Promise<ApiGatewayV2Response> {

  const ttl = new Date();
  ttl.setMinutes(ttl.getMinutes() + 60);

  // Pass the request to Signicat
  const params = new URLSearchParams(event.body);
  const resp = await fetch(process.env.TOKEN_ENDPOINT!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  // Parse claims form JWT
  const data = await resp.json() as any;
  if (process.env.DEBUG == 'true') {
    console.log('Token data', data);
  }
  const claims = jose.decodeJwt(data.id_token);

  // Store claims in dynamodb table
  if (!claims.sub) {
    throw Error('Sub should be set!');
  }
  await db.send(new PutItemCommand({
    TableName: process.env.TABLE_NAME,
    Item: {
      sub: { S: claims.sub },
      claims: { S: JSON.stringify(claims) },
      ttl: { N: ttl.getTime().toString() },
    },
  }));


  return {
    statusCode: resp.status,
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
    },
  };


}