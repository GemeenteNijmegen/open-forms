import { Logger } from '@aws-lambda-powertools/logger';
import { S3Client } from '@aws-sdk/client-s3';
import { EnrichedZgwObjectData } from '../shared/EnrichedZgwObjectData';
import { deduplicateFileNames } from './deduplicateFileNames';
import { FileDownloader } from './FileDownloader';
import { s3PathsFromFileData } from './s3PathsFromFileData';
import { S3Uploader } from './S3Uploader';


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

  async handle(objectData: EnrichedZgwObjectData) {
    // get files from documents
    const promises = [
      this.options.fileDownloader.fileDataFromDocument(objectData.pdf),
      ...objectData.attachments.map(attachment => this.options.fileDownloader.fileDataFromDocument(attachment)),
    ];
    let fileData = await Promise.all(promises);

    fileData[0].filename = `${objectData.reference}.pdf`;
    fileData = deduplicateFileNames(fileData);

    await this.options.s3Uploader.storeBulk(objectData.reference, fileData);
    const filePaths = s3PathsFromFileData(fileData, this.options.bucketName, objectData.reference);

    return {
      submission: objectData,
      filePaths,
    };
  }
}
