import { z } from 'zod';
import { esfWijzigingen, heeftWijzigingen } from './esfWijzigingen';
import { FileData, s3ObjectReferenceSchema, s3PathsFromFileData, s3StructuredObjectsFromFileData } from '../documentsToS3Storage/s3PathsFromFileData';
import { S3Uploader } from '../documentsToS3Storage/S3Uploader';
import { EnrichedZgwObjectDataSchema } from '../shared/EnrichedZgwObjectData';
import { EsfTaakSchema } from '../shared/EsfTaak';

/**
 * Output of the documents to S3 storage step for an ESF taak
 */
export const EsfProcessingInputSchema = z.object({
  enrichedObject: EnrichedZgwObjectDataSchema.extend({
    taak: EsfTaakSchema,
  }),
  filePaths: z.array(z.string()),
  fileObjects: z.array(s3ObjectReferenceSchema),
}).passthrough();

export interface EsfProcessingHandlerOptions {
  s3Uploader: S3Uploader;
  bucketName: string;
}

export class EsfProcessingHandler {
  constructor(private readonly options: EsfProcessingHandlerOptions) { }

  /**
   * Store an overview of the changes made by the citizen next to the
   * submission files, so it is picked up together with the other documents.
   * Without changes there is no overview and the input is passed on as is.
   */
  async handle(event: unknown) {
    const input = EsfProcessingInputSchema.parse(event);
    const { reference, s3SubFolder, taak } = input.enrichedObject;

    if (!heeftWijzigingen(taak)) {
      return input;
    }

    const wijzigingen: FileData = {
      filename: `${reference}-wijzigingen.txt`,
      data: Buffer.from(esfWijzigingen(taak, reference), 'utf-8'),
      format: 'text/plain; charset=utf-8',
      type: 'attachment',
    };
    await this.options.s3Uploader.store(reference, wijzigingen.filename, wijzigingen.data, wijzigingen.format, s3SubFolder);

    return {
      ...input,
      filePaths: [
        ...input.filePaths,
        ...s3PathsFromFileData([wijzigingen], this.options.bucketName, reference, s3SubFolder),
      ],
      fileObjects: [
        ...input.fileObjects,
        ...s3StructuredObjectsFromFileData([wijzigingen], this.options.bucketName, reference, s3SubFolder),
      ],
    };
  }
}
