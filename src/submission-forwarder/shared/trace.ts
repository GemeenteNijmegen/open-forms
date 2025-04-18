import { Logger } from "@aws-lambda-powertools/logger";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const logger = new Logger();
const dynamodb = new DynamoDBClient();

/**
 * Log the reference and handler to dynamodb for a trace over the
 * submisison and different handling parts.
 * @param reference 
 * @param handler 
 * @returns 
 */
export async function trace(reference: string, handler: string, success: boolean) {

  if (!process.env.TRACE_TABLE_NAME) {
    // just log, this is not a braking part of the handlers
    logger.error('Cannot log trace as the trace table name is not provided');
    return;
  }

  dynamodb.send(new PutItemCommand({
    Item: {
      'trace': { S: `${reference}#${handler}` },
      'timestamp': { S: new Date().toISOString() },
      'success': { BOOL: success },
    },
    TableName: process.env.TRACE_TABLE_NAME,
  }));

}