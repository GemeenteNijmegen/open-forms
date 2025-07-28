import { Logger } from '@aws-lambda-powertools/logger';
import { HttpClient as CatalogiHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import { HttpClient as ZakenHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { SubmissionForwarderHandler } from './Handler';
import { ZGWHandler } from './ZGWHandler';
import { ZGWRegistrationSubmissionSchema } from './ZGWRegistrationSubmission';
import { ZgwClientFactory } from '../shared/ZgwClientFactory';


const logger = new Logger();

let mijnServicesClientFactory: ZgwClientFactory | undefined = undefined;
let mijnServicesZakenClient: ZakenHttpClient | undefined = undefined;
let mijnServicesCatalogiClient: CatalogiHttpClient | undefined = undefined;

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
  if (!mijnServicesZakenClient) {
    mijnServicesZakenClient = await getMijnServicesZgwClientFactory().getZakenClient(
      env.ZAKEN_BASE_URL,
    );
  }
  if (!mijnServicesCatalogiClient) {
    mijnServicesCatalogiClient = await getMijnServicesZgwClientFactory().getCatalogiClient(
      env.CATALOGI_BASE_URL,
    );
  }
  const submission = ZGWRegistrationSubmissionSchema.parse(event);
  logger.info('ZGWRegistration start for', `${submission.reference} with type ${submission.zaaktypeIdentificatie}`);

  try {
    const zgwHandler = new ZGWHandler({
      zakenClient: mijnServicesZakenClient,
      catalogiClient: mijnServicesCatalogiClient,
    });
    await zgwHandler.handle(submission);
  } catch (error) {
    logger.error('Failed to ZGW register a form submision', { data: submission?.reference, error });
    throw Error(`Failed to ZGW register a form submision of type ${submission.zaaktypeIdentificatie}`);
  }


  // deprecated will delete after new implementation
  // const submissionForwarderHandler = new SubmissionForwarderHandler({
  //   zgwClientFactory: getMijnServicesZgwClientFactory(),
  //   documentenBaseUrl: env.DOCUMENTEN_BASE_URL,
  //   zakenBaseUrl: env.ZAKEN_BASE_URL,
  //   catalogiBaseUrl: env.CATALOGI_BASE_URL,
  // });
  // try {
  //   await submissionForwarderHandler.handle(submission);
  // } catch (error) {
  //   logger.error('Failed to forward a submission', { data: submission?.reference, error });
  //   throw Error('Failed register submission in ZGW');
  // }
  // end deprecation

  return submission;
}

function getMijnServicesZgwClientFactory() {
  if (!mijnServicesClientFactory) {
    mijnServicesClientFactory = new ZgwClientFactory({
      clientIdSsm: env.MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM,
      clientSecretArn: env.MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN,
      objectsApikeyArn: env.OBJECTS_API_APIKEY_ARN,
    });
  }
  return mijnServicesClientFactory;
}
