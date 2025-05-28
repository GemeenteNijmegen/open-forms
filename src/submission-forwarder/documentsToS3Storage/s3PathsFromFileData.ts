/**
 * This function creates s3 url paths from the filedata.
 */
export function s3PathsFromFileData(
  fileData: {
    data: Buffer<ArrayBuffer>;
    filename: string;
    format: string | undefined;
  }[],
  bucketName: string,
  reference: string) {
  const files = fileData.map(data => `s3://${bucketName}/${reference}/${data.filename}`);
  return files;
}
