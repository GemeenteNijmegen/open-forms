import { Logger } from '@aws-lambda-powertools/logger';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ALBEvent, ALBResult } from 'aws-lambda';

const logger = new Logger({ serviceName: 'StaticFromDefintionsFromS3' });
const s3 = new S3Client();

export async function handler(event: ALBEvent): Promise<ALBResult> {
  logger.debug('event', { event });

  // Parse event
  const pathParts = event.path.split('/');
  const stage = pathParts[1];
  const formDefUuid = pathParts[2];

  logger.info(`requesting Stage:${stage} formDefUuid${formDefUuid}`);

  const key = `${stage}/${formDefUuid}`;

  try {

    const definition = await s3.send(new GetObjectCommand({
      Bucket: process.env.FORM_DEF_BUCKET,
      Key: key,
    }));

    if (!definition || !definition.Body) {
      throw Error('Not found!');
    }

    return response(await definition.Body.transformToString(), 404);
  } catch (error) {
    return response(JSON.stringify({ error: 'not found' }), 404);
  }


}

function response(body: string, statusCode: number) {
  return {
    body: body,
    headers: {
      'Content-Type': 'application/json',
    },
    statusCode: statusCode,
  };
}