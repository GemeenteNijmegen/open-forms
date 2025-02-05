import { ApiGatewayV2Response } from "@gemeentenijmegen/apigateway-http";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "crypto";

export async function handler(_event: APIGatewayProxyEventV2):  Promise<ApiGatewayV2Response>{
  return {
    body: JSON.stringify({
      value: randomUUID(),
    }),
    statusCode: 200,
  }
}