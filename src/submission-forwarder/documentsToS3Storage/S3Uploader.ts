import { Logger } from "@aws-lambda-powertools/logger";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

export class S3Uploader {
  private client: S3Client;
  private logger: Logger;
  private bucket: string;

  constructor(bucketName: string, client?: S3Client, logger?: Logger) {
    this.client = client ?? new S3Client({});
    this.bucket = bucketName;
    this.logger = logger ?? new Logger();
  }

  async storeBulk(kenmerk: string, fileData: {filename: string, data: Buffer | string, formaat?: string}[]) {
    await Promise.all(fileData.map(file => this.store(kenmerk, file.filename, file.data, file.formaat)));
  }

  async store(kenmerk: string, filename: string, data: Buffer | string, formaat?: string) {
    const key = `${kenmerk}/${filename}`;
    this.logger.debug('Uploading file...', {
      filePath: key,
      fileSize: data instanceof Buffer ? data.byteLength : data.length,
    });
    const upload = new Upload({ // parallel multipart upload
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: formaat,
      },
    });
    await upload.done();
  }
}
