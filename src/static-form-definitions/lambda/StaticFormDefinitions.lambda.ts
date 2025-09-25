import { Logger } from '@aws-lambda-powertools/logger';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ALBEvent, ALBResult } from 'aws-lambda';

const logger = new Logger({ serviceName: 'StaticFromDefintionsFromS3' });
const s3 = new S3Client();

export async function handler(event: ALBEvent): Promise<ALBResult> {
  logger.debug('event', { event });

  // Parse event
  const pathParts = event.path.split('/');
  const stage = pathParts[2];

  // Find the identifier in the url
  const requestUsesId = pathParts[3] == 'form';
  const requestIsNested = pathParts[4] == 'nested';
  let formIdentifier = pathParts[3];
  if (requestUsesId) {
    formIdentifier = pathParts[4];
  }
  if (requestIsNested) {
    formIdentifier = pathParts[5];
  }

  logger.info(`requesting Stage: ${stage} and form identifier: ${formIdentifier}`);

  const key = `${stage}/${formIdentifier}`;

  try {

    const definition = await s3.send(new GetObjectCommand({
      Bucket: process.env.FORM_DEF_BUCKET,
      Key: key,
    }));

    if (!definition || !definition.Body) {
      return response(JSON.stringify({ error: 'not found' }), 404);
    }

    return response(await definition.Body.transformToString(), 200);

  } catch (error) {
    return response(JSON.stringify({ error: 'Something went wrong' }), 500);
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