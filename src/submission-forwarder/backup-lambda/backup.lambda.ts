import { Logger } from '@aws-lambda-powertools/logger';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { SNSEvent } from 'aws-lambda';
import { SubmissionSchema } from '../shared/Submission';

const logger = new Logger();
const s3 = new S3Client();

export async function handler(event: SNSEvent) {
  logger.debug('Received event', { event });
  const object = JSON.parse(event.Records[0].Sns.Message); // Can max be of length 1
  const submisison = SubmissionSchema.parse(object);
  s3.send(new PutObjectCommand({
    Bucket: process.env.BACKUP_TABLE_NAME,
    Key: submisison.reference,
    Body: JSON.stringify(submisison),
  }));
  logger.info('Backup completed for object', { reference: submisison.reference })
}