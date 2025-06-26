import path from 'path';
import { Logger } from '@aws-lambda-powertools/logger';
import { Enkelvoudiginformatieobjecten } from '@gemeentenijmegen/modules-zgw-client/lib/documenten-generated-client';
import { FileData } from './s3PathsFromFileData';

/**
 * This class is responsible for downloading files from ZGW documenten storage.
 *
 * It takes in URL's to enkelvoudiginformatieobjecten, and returns an object
 * containing the data (as a Buffer), the filename and file format.
 */

export class FileDownloader {
  private documenten: Enkelvoudiginformatieobjecten;
  private logger: Logger;

  constructor(documenten: Enkelvoudiginformatieobjecten) {
    this.documenten = documenten;
    this.logger = new Logger();
  }

  /**
   * Retrieve an enkelvoudiginformatieobject from URL, return relevant data for storage and forwarding.
   *
   * @param url         the enkelvoudiginformatieObject to retrieve
   * @param pathPrefix  optional prefix to add to the filename. Used to make sure attachment-filenames can't collide with submission filenames. This
   *                    will be joined using path.join, so no path separator is necessary.
   */
  async fileDataFromDocument(url: string, pathPrefix?: string): Promise<FileData> {
    const uuid = this.getUuidFromUrl(url);
    const attachmentDetails = await this.documenten.enkelvoudiginformatieobjectRetrieve({ uuid });
    const attachmentData = await this.documenten.enkelvoudiginformatieobjectDownload({ uuid }, {
      responseEncoding: 'binary',
    });
    if (!attachmentDetails.data.bestandsnaam) {
      this.logger.error('Missing attachment with uuid, as it does not have a filename', { uuid });
      throw Error('No filename found for file');
    }

    const filePath = pathPrefix ? path.join(pathPrefix, attachmentDetails.data.bestandsnaam) : attachmentDetails.data.bestandsnaam;
    const data = Buffer.from(attachmentData.data as any, 'binary'); // Note it looks like pdfData.data is a File, this is false its binary data disguising as a string.
    const result = {
      data,
      filename: filePath,
      format: attachmentDetails.data.formaat,
    };
    return result;
  }

  getUuidFromUrl(url: string) {
    const parts = url.split('/');
    return parts[parts.length - 1];
  }
}
