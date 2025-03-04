import { Logger } from '@aws-lambda-powertools/logger';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { documenten } from '@gemeentenijmegen/modules-zgw-client';
import { SQSRecord } from 'aws-lambda';
import { ZgwClientFactory } from './ZgwClientFactory';
import { Notification, NotificationSchema } from '../shared/Notification';
import { Submission, SubmissionSchema } from '../shared/Submission';

const logger = new Logger();
const s3 = new S3Client();
const sqs = new SQSClient();

interface SubmissionForwarderHandlerOptions {
  zgwClientFactory: ZgwClientFactory;
  documentenBaseUrl: string;
  bucketName: string;
  queueUrl: string;
}

export class SubmissionForwarderHandler {


  /**
   * Handle incomming notifications from the objects api
   */
  constructor(private readonly options: SubmissionForwarderHandlerOptions) { }

  async handle(event: SQSRecord) {

    const notification = this.getNotification(event);
    logger.debug('Parsed notification', { notification });

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

    // Construct SQS message to send to the ESB
    await this.sendNotificationToQueue(this.options.queueUrl, submission);

  }

  /**
   * Send a notification to an sqs queue
   * @param queueUrl
   * @param submission
   */
  private async sendNotificationToQueue(queueUrl: string, submission: Submission) {
    try {
      await sqs.send(new SendMessageCommand({
        MessageBody: JSON.stringify(submission),
        QueueUrl: queueUrl,
      }));
    } catch (error) {
      logger.error('Could not send submission to ESB queue', { error });
      throw new Error('Failed to send submission to ESB queue');
    }
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
   * Parses the event and constructs a Notification
   * @param event
   * @returns
   */
  private getNotification(event: SQSRecord): Notification {
    const bodyJson = JSON.parse(event.body);
    return NotificationSchema.parse(bodyJson);
  }

}
