import { Logger } from "@aws-lambda-powertools/logger";
import { S3Client } from "@aws-sdk/client-s3";
import { Submission } from "../shared/Submission";
import { FileDownloader } from "./FileDownloader";
import { S3Uploader } from "./S3Uploader";
import { s3PathsFromFileData } from "./s3PathsFromFileData";


export interface DocumentsToS3StorageHandlerOptions {
  fileDownloader: FileDownloader;
  s3Uploader: S3Uploader;
  documentenBaseUrl: string;
  bucketName: string;
  logger?: Logger;
  s3Client?: S3Client;
}

export class DocumentsToS3StorageHandler {
  /**
   * Handle incoming notifications from the objects api
   */
  constructor(private readonly options: DocumentsToS3StorageHandlerOptions) { }

  async handle(submission: Submission) {
    // get files from documents
    const promises = [
      this.options.fileDownloader.fileDataFromDocument(submission.pdf),
      ...submission.attachments.map(attachment => this.options.fileDownloader.fileDataFromDocument(attachment)),
    ];
    const fileData = await Promise.all(promises);
    this.options.s3Uploader.storeBulk(submission.reference, fileData);

    const files = s3PathsFromFileData(fileData, this.options.bucketName, submission.reference);

    return {
      submission,
      files
    }
  }
}
