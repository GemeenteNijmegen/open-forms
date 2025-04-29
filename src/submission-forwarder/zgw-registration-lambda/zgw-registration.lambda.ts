import { Logger } from '@aws-lambda-powertools/logger';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { SubmissionForwarderHandler } from './Handler';
import { SubmissionSchema } from '../shared/Submission';
import { ZgwClientFactory } from '../shared/ZgwClientFactory';

const logger = new Logger();

let clientFactory: ZgwClientFactory | undefined = undefined;
const env = environmentVariables([
  'DOCUMENTEN_BASE_URL',
  'ZAKEN_BASE_URL',
  'CATALOGI_BASE_URL',
  'MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM',
  'MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN',
  'OBJECTS_API_APIKEY_ARN',
]);

export async function handler(event: any) {
  logger.debug('event', { event });

  const submissionForwarderHandler = new SubmissionForwarderHandler({
    zgwClientFactory: getZgwClientFactory(),
    documentenBaseUrl: env.DOCUMENTEN_BASE_URL,
    zakenBaseUrl: env.ZAKEN_BASE_URL,
    catalogiBaseUrl: env.CATALOGI_BASE_URL,
  });

  let submission = undefined;

  // Event is a SNS event
  if (event.Records) {
    submission = SubmissionSchema.parse(JSON.parse(event.Records[0].Sns.Message));
  }

  // Event is a submission object directly
  if (event.reference && event.formName) {
    submission = SubmissionSchema.parse(event);
  }

  try {

    if (!submission) {
      throw Error('Event is not a SNS event nor a submission');
    }

    await submissionForwarderHandler.handle(submission);

  } catch (error) {
    logger.error('Failed to forward a submission', { data: submission?.reference, error });
    throw Error('Failed register submission in ZGW');
  }
}

function getZgwClientFactory() {
  if (!clientFactory) {
    clientFactory = new ZgwClientFactory({
      clientIdSsm: env.MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM,
      clientSecretArn: env.MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN,
      objectsApikeyArn: env.OBJECTS_API_APIKEY_ARN,
    });
  }
  return clientFactory;
}