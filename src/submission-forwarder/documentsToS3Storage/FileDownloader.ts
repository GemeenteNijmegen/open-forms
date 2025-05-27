import { Logger } from "@aws-lambda-powertools/logger";
import { Enkelvoudiginformatieobjecten } from "@gemeentenijmegen/modules-zgw-client/lib/documenten-generated-client";

export class FileDownloader {
  private documenten: Enkelvoudiginformatieobjecten;
  private logger: Logger;

  constructor(documenten: Enkelvoudiginformatieobjecten) {
    this.documenten = documenten;
    this.logger = new Logger();
  }

  async fileDataFromDocument(url: string) {
    const uuid = this.getUuidFromUrl(url);
    const attachmentDetails = await this.documenten.enkelvoudiginformatieobjectRetrieve({ uuid });
    const attachmentData = await this.documenten.enkelvoudiginformatieobjectDownload({ uuid }, {
      responseEncoding: 'binary',
    });
    if (!attachmentDetails.data.bestandsnaam) {
      this.logger.error('Missing attachment with uuid, as it does not have a filename', { uuid });
      throw Error('No filename found for file');
    }

    const data = Buffer.from(attachmentData.data as any, 'binary'); // Note it looks like pdfData.data is a File, this is false its binary data disguising as a string.
    const result = {
      data,
      filename: attachmentDetails.data.bestandsnaam,
      format: attachmentDetails.data.formaat
    }
    return result;
  }

  getUuidFromUrl(url: string) {
    const parts = url.split('/');
    return parts[parts.length - 1];
  }
}
