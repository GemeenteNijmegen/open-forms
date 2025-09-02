import { createHash } from 'crypto';
import { Logger } from '@aws-lambda-powertools/logger';
import { S3Client } from '@aws-sdk/client-s3';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Upload } from '@aws-sdk/lib-storage';
import { EsbSubmission } from '../shared/EsbSubmission';
import { KeyValuePair, Submission } from '../shared/Submission';
import { trace } from '../shared/trace';
import { ZgwClientFactory } from '../shared/ZgwClientFactory';


const HANDLER_ID = 'ESB_FORWARDER';
const logger = new Logger();
const s3 = new S3Client();
const sqs = new SQSClient();

interface SubmissionForwarderHandlerOptions {
  zgwClientFactory: ZgwClientFactory;
  documentenBaseUrl: string;
  zakenBaseUrl: string;
  catalogiBaseUrl: string;
  bucketName: string;
  queueUrl: string;
}


export class SubmissionForwarderHandler {


  /**
   * Handle incomming notifications from the objects api
   */
  constructor(private readonly options: SubmissionForwarderHandlerOptions) { }

  async handle(submission: Submission, filePaths: string[]) {

    // Message is the submission
    logger.debug('Retreived submisison', { submission });

    // Only handle submissions with a network share
    if (!submission.networkShare) {
      logger.error('Submission does not have a networkshare location, ignoring the submission');
      return;
    }

    const saveFileS3Urls = await this.createSaveFiles(submission);
    const s3Files: string[] = [
      ...filePaths,
      ...saveFileS3Urls,
    ];

    // Build an EsbSubmission and send it to the queue
    const esb: EsbSubmission = {
      s3Files: s3Files,
      folderName: `${submission.formName}-${submission.reference}`,
      targetNetworkLocation: submission.networkShare,
    };
    await this.sendNotificationToQueue(this.options.queueUrl, esb);

    // Also send files to monitoring location if provided in submission
    if (submission.monitoringNetworkShare) {
      const monitoringEsbMessage: EsbSubmission = { ...esb, targetNetworkLocation: submission.monitoringNetworkShare };
      await this.sendNotificationToQueue(this.options.queueUrl, monitoringEsbMessage);
    }

    await trace(submission.reference, HANDLER_ID, 'OK');
  }

  /**
 * Check if the submission requires submissionValuesToFiles.
 * If so, create them and return the paths.
 * @param submission Submission data
 * @returns - List of paths of the created save files
 */
  private async createSaveFiles(submission: Submission): Promise<string[]> {
    const s3Files: string[] = [];

    // BSN or KVK save file
    if (submission.bsnOrKvkToFile) {
      try {
        if (submission.kvk) {
          await this.storeInS3(submission.reference, 'kvk.txt', submission.kvk);
          const attachmentS3Path = `s3://${this.options.bucketName}/${submission.reference}/kvk.txt`;
          s3Files.push(attachmentS3Path);
        }
        if (submission.bsn) {
          await this.storeInS3(submission.reference, 'bsn.txt', submission.bsn);
          const attachmentS3Path = `s3://${this.options.bucketName}/${submission.reference}/bsn.txt`;
          s3Files.push(attachmentS3Path);
        }
      } catch (error: any) {
        console.log('Failed to create kvk/bsn save file');
      }
    }

    // Payment save file
    if (submission.payment) {
      try {
        await this.storeInS3(submission.reference, 'payment.txt', JSON.stringify(submission.payment));
        const attachmentS3Path = `s3://${this.options.bucketName}/${submission.reference}/payment.txt`;
        s3Files.push(attachmentS3Path);
      } catch (error: any) {
        console.log('Failed to create payment save file');
      }
    }

    // Other save files based on free data structure
    const submissionValues: KeyValuePair[] = submission.submissionValuesToFiles ?? [];
    for (const [name, value] of submissionValues) {
      if (!value) continue;
      try {
        const fileName = `${name}.txt`;
        const fileContent = String(value);

        await this.storeInS3(submission.reference, fileName, fileContent);
        const attachmentS3Path = `s3://${this.options.bucketName}/${submission.reference}/${fileName}`;
        s3Files.push(attachmentS3Path);
      } catch (error: any) {
        logger.error(`Failed to create saveFile for ${name} - ${submission.reference}`);
      }
    }
    return s3Files;
  }


  /**
   * Send a notification to an sqs queue
   * @param queueUrl
   * @param submission
   */
  private async sendNotificationToQueue(queueUrl: string, esb: EsbSubmission) {
    try {

      console.debug('Sending to queue', { esb });

      // Deduplication ID must be different for each unique message! (i.e. folderName is not sufficient)
      const hash = createHash('sha256').update(`${esb.folderName}:${esb.targetNetworkLocation}`).digest('hex');

      await sqs.send(new SendMessageCommand({
        MessageBody: JSON.stringify(esb),
        QueueUrl: queueUrl,
        MessageGroupId: 'EsbSubmissions',
        MessageDeduplicationId: hash,
      }));
    } catch (error) {
      logger.error('Could not send submission to ESB queue', { error });
      throw new Error('Failed to send submission to ESB queue');
    }
  }

  private async storeInS3(kenmerk: string, filename: string, data: Buffer | string, formaat?: string) {
    const key = `${kenmerk}/${filename}`;
    logger.debug('Uploading file...', {
      filePath: key,
      fileSize: data instanceof Buffer ? data.byteLength : data.length,
    });
    const upload = new Upload({ // parallel multipart upload
      client: s3,
      params: {
        Bucket: this.options.bucketName,
        Key: key,
        Body: data,
        ContentType: formaat,
      },
    });
    await upload.done();
  }
}
