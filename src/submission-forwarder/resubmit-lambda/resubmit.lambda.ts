import { Logger } from '@aws-lambda-powertools/logger';
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { MessageAttributeValue, PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult, SNSEvent } from 'aws-lambda';
import { authenticate } from './authenticate';
import { Submission, SubmissionSchema } from '../shared/Submission';
import { trace } from '../shared/trace';

const HANDLER_ID = 'RESUBMIT';
const logger = new Logger();
const s3 = new S3Client();
const sns = new SNSClient();

const env = environmentVariables([
  'BACUP_BUCKET',
  'TOPIC_ARN',
]);


export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  logger.debug('event', { event });

  await authenticate(event);

  const reference = event.queryStringParameters?.reference;
  if (!reference) {
    return response({ message: 'Please provide a reference to resubmit (url param)' }, 400);
  }

  try {

    const objects = await s3.send(new ListObjectsV2Command({
      Bucket: env.BACUP_BUCKET,
      Prefix: reference,
    }));

    if (objects.Contents?.length != 1) {
      return response({ message: `Found ${objects.Contents?.length ?? 0} objects.` }, 400);
    }

    const object = objects.Contents[0].Key;

    const backupObject = await s3.send(new GetObjectCommand({
      Bucket: env.BACUP_BUCKET,
      Key: object,
    }));

    const backup = JSON.parse(await backupObject.Body?.transformToString() ?? '{}') as SNSEvent;
    const submission = SubmissionSchema.parse(JSON.parse(backup.Records[0].Sns.Message));

    // Convert attributes for resubmit
    const attributes: any = {};
    Object.entries(backup.Records[0].Sns.MessageAttributes).forEach((x) => {
      attributes[x[0]] = x[1];
    });
    attributes.resubmit = { Type: 'String', Value: 'true' };

    await sendToTopic(env.TOPIC_ARN, submission, attributes);
    await trace(submission.reference, HANDLER_ID, 'OK');

    return response({ message: 'Failed to resubmit' }, 500);


  } catch (error) {
    logger.error('Could not process notification', { error });
    return response({ message: 'Failed to resubmit' }, 500);
  }

}

/**
 * Construct a simple response for the API Gateway to return
 * @param body
 * @param statusCode
 * @returns
 */
function response(body?: any, statusCode: number = 200): APIGatewayProxyResult {
  return {
    statusCode,
    body: JSON.stringify(body) ?? '{}',
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

async function sendToTopic(topicArn: string, submission: Submission, attributes: Record<string, MessageAttributeValue>) {
  try {
    await sns.send(new PublishCommand({
      Message: JSON.stringify(submission),
      MessageAttributes: attributes,
      TopicArn: topicArn,
    }));
  } catch (error) {
    logger.error('Could not send submission to topic', { error });
    throw new Error('Failed to send submission to topic');
  }
}