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
  logger.info('HANDLER-TRACE', {
    trace: `${reference}#${handler}`,
    traceMessage: message,
  });
}