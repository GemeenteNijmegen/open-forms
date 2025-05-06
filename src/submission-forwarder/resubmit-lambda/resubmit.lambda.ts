import { Logger } from '@aws-lambda-powertools/logger';
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { Response } from '@gemeentenijmegen/apigateway-http/lib/V1/Response';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult, SNSEvent } from 'aws-lambda';
import { Submission, SubmissionSchema } from '../shared/Submission';
import { trace } from '../shared/trace';
import { authenticate } from './authenticate';

const HANDLER_ID = 'RESUBMIT';
const logger = new Logger();
const s3 = new S3Client();
const stepfunctions = new SFNClient();

const env = environmentVariables([
  'BACUP_BUCKET',
  'ORCHESTRATOR_ARN',
]);

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  logger.debug('event', { event });

  await authenticate(event);

  const reference = event.queryStringParameters?.reference;
  if (!reference) {
    return Response.json({ message: 'Please provide a reference to resubmit (url param)' }, 400);
  }

  try {

    const submission = await fetchSubmissionFromBackupBucket(reference);
    await startNewExecution(submission);

    await trace(submission.reference, HANDLER_ID, 'OK');
    return Response.json({ message: 'Failed to resubmit' }, 500);

  } catch (error) {

    if (error instanceof NotFoundError) {
      logger.error(error.message);
      return Response.json({ message: error.message }, 400);
    }

    logger.error('Could not process notification', { error });
    return Response.json({ message: 'Failed to resubmit' }, 500);
  }

}

async function fetchSubmissionFromBackupBucket(reference: string): Promise<Submission> {
  const objects = await s3.send(new ListObjectsV2Command({
    Bucket: env.BACUP_BUCKET,
    Prefix: reference,
  }));

  if (objects.Contents?.length != 1) {
    throw new NotFoundError(`Found ${objects.Contents?.length ?? 0} objects.`);
  }

  const object = objects.Contents[0].Key;

  const backupObject = await s3.send(new GetObjectCommand({
    Bucket: env.BACUP_BUCKET,
    Key: object,
  }));

  const backup = JSON.parse(await backupObject.Body?.transformToString() ?? '{}') as SNSEvent;
  const submission = SubmissionSchema.parse(JSON.parse(backup.Records[0].Sns.Message));
  return submission;
}

async function startNewExecution(submission: Submission) {
  const execution = await stepfunctions.send(new StartExecutionCommand({
    stateMachineArn: env.ORCHESTRATOR_ARN,
    input: JSON.stringify(submission),
    name: `${submission.reference}-${Date.now()}`,
  }));
  logger.info('Started orchestrator', { executionArn: execution.executionArn });
}

class NotFoundError extends Error { };