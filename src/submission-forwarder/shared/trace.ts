import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger();

/**
 * Log the reference and handler to dynamodb for a trace over the
 * submisison and different handling parts.
 * @param reference
 * @param handler
 * @returns
 */
export async function trace(reference: string, handler: string, message: string) {

  if (!process.env.TRACE_TABLE_NAME) {
    // just log, this is not a braking part of the handlers
    logger.error('Cannot log trace as the trace table name is not provided');
    return;
  }

  logger.info('HANDLER-TRACE', {
    trace: `${reference}#${handler}`,
    timestamp: new Date().toISOString(),
    message: message,
  });

}