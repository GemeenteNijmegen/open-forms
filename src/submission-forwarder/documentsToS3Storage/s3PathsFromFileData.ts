
export interface FileData {
  data: Buffer<ArrayBuffer>;
  filename: string;
  format: string | undefined;
}
/**
 * This function creates s3 url paths from the filedata.
 */
export function s3PathsFromFileData(
  fileData: FileData[],
  bucketName: string,
  reference: string) {

  const files = fileData.map(data => `s3://${bucketName}/${reference}/${data.filename}`);
  return files;
}
