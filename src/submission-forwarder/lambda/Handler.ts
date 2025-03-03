import { Logger } from '@aws-lambda-powertools/logger';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { documenten } from '@gemeentenijmegen/modules-zgw-client';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { authenticate } from './authenticate';
import { Notification, NotificationSchema } from './Notification';
import { SubmissionSchema } from './Submission';
import { ZgwClientFactory } from './ZgwClientFactory';

const logger = new Logger();
const s3 = new S3Client();

interface SubmissionForwarderHandlerOptions {
  zgwClientFactory: ZgwClientFactory;
  documentenBaseUrl: string; // E.g. https://mijn-services.accp.nijmegen.nl/open-zaak/documenten/api/v1/enkelvoudiginformatieobjecten
  bucketName: string;
}

export class SubmissionForwarderHandler {


  /**
   * Handle incomming notifications from the objects api
   */
  constructor(private readonly options: SubmissionForwarderHandlerOptions) { }

  async handle(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {

    await authenticate(event);

    const notification = this.getNotification(event);
    logger.debug('Parsed notification', { notification });

    // Handle test notifications
    if (notification.kanaal == 'test') {
      logger.info('Test notificatie ontvangen');
      return this.response({ message: 'OK - test event' });
    }

    // Get the object from the object api
    const objectClient = await this.options.zgwClientFactory.getObjectsApiClient();
    const object = await objectClient.getObject(notification.resourceUrl);
    const submission = SubmissionSchema.parse(object.record.data);
    logger.debug('Retreived submisison', { submission });

    // Collect de documents from the document API and forward those to the target S3 bucket
    const httpClient = await this.options.zgwClientFactory.getDocumentenClient(this.options.documentenBaseUrl);
    const documentenClient = new documenten.Enkelvoudiginformatieobjecten(httpClient);

    // Store the pdf in S3
    const uuid = this.getUuidFromUrl(submission.pdf);
    const pdfData = await documentenClient.enkelvoudiginformatieobjectDownload({ uuid });
    await this.storeInS3(submission.reference, submission.reference + '.pdf', pdfData.data);

    // Store attachments in S3
    for (const attachment of submission.attachments) {
      const attachmentUuid = this.getUuidFromUrl(attachment);
      const attachmentDetails = await documentenClient.enkelvoudiginformatieobjectRetrieve({ uuid: attachmentUuid });
      const attachmentData = await documentenClient.enkelvoudiginformatieobjectDownload({ uuid: attachmentUuid });
      if (!attachmentDetails.data.bestandsnaam) {
        logger.error('Missing attachment with uuid, as it does not have a filename', { uuid: attachmentUuid });
        continue;
      }
      await this.storeInS3(submission.reference, attachmentDetails.data.bestandsnaam, attachmentData.data);
    }

    // TODO Construct a nice SQS message to send to the ESB

    return this.response({ message: 'OK' });
  }

  private async storeInS3(kenmerk: string, filename: string, data: any) {
    const key = `${kenmerk}/${filename}`;
    await s3.send(new PutObjectCommand({
      Bucket: this.options.bucketName,
      Key: key,
      Body: data,
    }));
  }

  private getUuidFromUrl(url: string) {
    const parts = url.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Construct a simple response for the API Gateway to return
   * @param body
   * @param statusCode
   * @returns
   */
  private response(body?: any, statusCode: number = 200): APIGatewayProxyResult {
    return {
      statusCode,
      body: JSON.stringify(body) ?? '{}',
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  /**
   * Parses the event and constructs a Notification
   * @param event
   * @returns
   */
  private getNotification(event: APIGatewayProxyEvent): Notification {
    if (!event.body) {
      throw Error('No body found in event');
    }
    let body = event.body;
    if (event.isBase64Encoded) {
      body = Buffer.from(event.body, 'base64').toString('utf-8');
    }
    const bodyJson = JSON.parse(body);
    return NotificationSchema.parse(bodyJson);
  }

}
