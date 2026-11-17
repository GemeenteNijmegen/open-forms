import { Logger } from '@aws-lambda-powertools/logger';
import { S3Client } from '@aws-sdk/client-s3';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { EsfProcessingHandler } from './EsfProcessingHandler';
import { S3Uploader } from '../documentsToS3Storage/S3Uploader';

const logger = new Logger();
const s3Client = new S3Client({});

const env = environmentVariables([
  'SUBMISSION_BUCKET_NAME',
]);

const esfProcessingHandler = new EsfProcessingHandler({
  s3Uploader: new S3Uploader(env.SUBMISSION_BUCKET_NAME, s3Client, logger),
  bucketName: env.SUBMISSION_BUCKET_NAME,
});

export async function handler(event: any) {
  logger.debug('event', { event });
  return esfProcessingHandler.handle(event);
}
