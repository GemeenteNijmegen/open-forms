
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { calculateCost } from './costCalculation';
import { parseEvent, ParseError } from './parser';

export async function handler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const input = parseEvent(event);
    const cost = calculateCost(input);

    return {
      statusCode: 200,
      body: JSON.stringify({ value: cost }),
    };
  } catch (error) {
    if (error instanceof ParseError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid request',
          message: error.message,
          // Structured issues for API consumers
          issues: error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        }),
      };
    }
    if (error instanceof Error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Calculation error',
          message: error.message,
        }),
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
