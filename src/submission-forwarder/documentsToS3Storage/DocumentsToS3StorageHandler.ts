import { Logger } from '@aws-lambda-powertools/logger';
import { S3Client } from '@aws-sdk/client-s3';
import { addTypeReferencesToFileData } from './addTypeReferencesToFileData';
import { FileDownloader } from './FileDownloader';
import { s3PathsFromFileData, s3StructuredObjectsFromFileData } from './s3PathsFromFileData';
import { S3Uploader } from './S3Uploader';
import { EnrichedZgwObjectData } from '../shared/EnrichedZgwObjectData';


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

    fileData = addTypeReferencesToFileData(fileData, objectData.reference);

    await this.options.s3Uploader.storeBulk(objectData.reference, fileData);
    // We add both filePaths and fileObjects for backwards compatibility reasons. We only have one client, after it's been
    // modified filePaths can be removed. TODO (10-6-2025): Check with ESB if filePaths is still in use
    const filePaths = s3PathsFromFileData(fileData, this.options.bucketName, objectData.reference);
    const fileObjects = s3StructuredObjectsFromFileData(fileData, this.options.bucketName, objectData.reference);

    return {
      enrichedObject: objectData,
      filePaths,
      fileObjects,
    };
  }
}


