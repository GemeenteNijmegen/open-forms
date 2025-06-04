import { Logger } from '@aws-lambda-powertools/logger';
import { S3Client } from '@aws-sdk/client-s3';

import { Enkelvoudiginformatieobjecten } from '@gemeentenijmegen/modules-zgw-client/lib/documenten-generated-client';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { EnrichedZgwObjectDataSchema } from '../shared/EnrichedZgwObjectData';
import { ZgwClientFactory } from '../shared/ZgwClientFactory';
import { DocumentsToS3StorageHandler } from './DocumentsToS3StorageHandler';
import { FileDownloader } from './FileDownloader';
import { S3Uploader } from './S3Uploader';

const logger = new Logger();
const s3Client = new S3Client({});
let clientFactory: ZgwClientFactory | undefined = undefined;
let documentenClient: Enkelvoudiginformatieobjecten | undefined = undefined;


const env = environmentVariables([
  'DOCUMENTEN_BASE_URL',
  'MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM',
  'MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN',
  'SUBMISSION_BUCKET_NAME',
  'OBJECTS_API_APIKEY_ARN',
]);

export async function handler(event: any) {
  logger.debug('event', { event });


  const documentsToS3StorageHandler = new DocumentsToS3StorageHandler({
    s3Uploader: new S3Uploader(env.SUBMISSION_BUCKET_NAME, s3Client, logger),
    fileDownloader: new FileDownloader(await getDocumentenClient(getZgwClientFactory(), env.DOCUMENTEN_BASE_URL)),
    documentenBaseUrl: env.DOCUMENTEN_BASE_URL,
    bucketName: env.SUBMISSION_BUCKET_NAME,
    s3Client,
    logger,
  });

  // Data can be a submission object or esf taak, but both are presented in a common format
  const objectData = EnrichedZgwObjectDataSchema.parse(event);
  return documentsToS3StorageHandler.handle(objectData);
}

async function getDocumentenClient(zgwClientFactory: ZgwClientFactory, baseUrl: string) {
  if (!documentenClient) {
    const httpClient = await zgwClientFactory.getDocumentenClient(baseUrl);
    documentenClient = new Enkelvoudiginformatieobjecten(httpClient);
  }
  return documentenClient;
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
