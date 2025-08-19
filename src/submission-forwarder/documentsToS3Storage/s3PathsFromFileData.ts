import { z } from 'zod';

export interface FileData {
  data: Buffer<ArrayBuffer>;
  filename: string;
  format: string | undefined;
  type?: 'submission' | 'attachment';
}

export const s3ObjectReferenceSchema = z.object({
  bucket: z.string(),
  objectKey: z.string(),
  fileName: z.string(),
  objectType: z.enum(['submission', 'attachment']).optional(),
});
type s3ObjectReference = z.infer<typeof s3ObjectReferenceSchema>;
/**
 * This function creates s3 url paths from the filedata.
 *
 * @deprecated Use s3StructuredObjectsFromFiledata from now on. Not yet removed for backwards
 * compatibility reasons.
 */
export function s3PathsFromFileData(fileData: FileData[], bucketName: string, reference: string, subdirectory?: string) {
  if (subdirectory) {
    return fileData.map(data => `s3://${bucketName}/${subdirectory}/${reference}/${data.filename}`);
  }
  return fileData.map(data => `s3://${bucketName}/${reference}/${data.filename}`);
}

/**
 * This function creates s3 url paths from the filedata.
 */
export function s3StructuredObjectsFromFileData(
  fileData: FileData[],
  bucketName: string,
  reference: string,
  subdirectory?: string): s3ObjectReference[] {

  const files = fileData.map(data => {

    // Add subdirectory when provided
    let path = `${reference}/${data.filename}`;
    if (subdirectory) {
      path = `${subdirectory}/${path}`;
    }

    return {
      bucket: bucketName,
      objectKey: path,
      fileName: data.filename,
      objectType: data.type,
    };
  });
  return files;
}
