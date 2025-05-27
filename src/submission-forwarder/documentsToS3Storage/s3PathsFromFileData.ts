
export function s3PathsFromFileData(
  fileData: {
    data: Buffer<ArrayBuffer>;
    filename: string;
    format: string | undefined;
  }[],
  bucketName: string,
  reference: string) {

  fileData.shift();
  const files = fileData.map(data => `s3://${bucketName}/${reference}/${data.filename}`);
  files.push(`s3://${bucketName}/${reference}/${reference}.pdf`);
  return files;
}
