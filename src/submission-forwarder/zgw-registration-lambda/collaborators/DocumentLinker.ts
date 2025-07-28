import { Logger } from '@aws-lambda-powertools/logger';
import * as zaken from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { HttpClient as ZakenHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { ZGWRegistrationSubmission } from '../ZGWRegistrationSubmission';

let logger: Logger;

export interface DocumentLinkerConfig {
  zakenClient: ZakenHttpClient;
  logger?: Logger;
}

export class DocumentLinker {
  private zakenClient: ZakenHttpClient;
  private alreadyLinkedFiles: string[] = [];
  errors: { fileUrl: string; error: any }[] = [];

  constructor(config: DocumentLinkerConfig) {
    this.zakenClient = config.zakenClient;
    logger = config.logger ?? new Logger();
  }

  /**
     * @param submission: ZGWRegistationSubmission
     * @param zaakUrl: string
     */
  async linkAllDocuments(submission: ZGWRegistrationSubmission, zaakUrl: string): Promise<void> {
    this.alreadyLinkedFiles = await this.getAlreadyLinkedInformatieObjecten(zaakUrl);
    await this.linkPDF(submission, zaakUrl);
    await this.linkAttachments(submission, zaakUrl);
    if (this.errors.length > 0) {
      logger.error(`Adding (some) documents failed for ${submission.reference} ${submission.zaaktypeIdentificatie}. They will be listed below.`);
      this.errors.forEach((err, index) => logger.error(`${index} fail: ${err.fileUrl} with error ${err.error}`));
      throw Error(`Adding ${this.errors.length} documents failed for ${submission.reference} ${submission.zaaktypeIdentificatie}`);
    }
    logger.info(`SUCCESS Documentlinker: all files were linked to ${submission.reference}`);
  }


  async linkPDF(submission: ZGWRegistrationSubmission, zaakUrl: string): Promise<void> {
    await this.linkFileToZaak(zaakUrl, submission.pdf);
  }

  async linkAttachments(submission: ZGWRegistrationSubmission, zaakUrl: string): Promise<void> {
    for (const attachment of submission.attachments ?? []) {
      await this.linkFileToZaak(zaakUrl, attachment);
    }
  }

  async linkFileToZaak(zaakUrl: string, fileUrl: string) {
    if (this.alreadyLinkedFiles.includes(fileUrl)) {
      logger.debug(`Skipping ${fileUrl} – already linked to ${zaakUrl}`);
      return;
    }
    try {
      const zaakInformatieObjectApi = new zaken.Zaakinformatieobjecten(this.zakenClient);
      const added = await zaakInformatieObjectApi.zaakinformatieobjectCreate({
        zaak: zaakUrl,
        informatieobject: fileUrl,
      });
      logger.debug(`Added attachment to zaak ${added.data.uuid}`);
    } catch (err) {
      this.errors.push({ fileUrl, error: err });
    }

  }
  async getAlreadyLinkedInformatieObjecten(zaakUrl: string): Promise<string[]> {
    try {
      const api = new zaken.Zaakinformatieobjecten(this.zakenClient);
      const response = await api.zaakinformatieobjectList({ zaak: zaakUrl });
      return response.data.map(item => item.informatieobject);
    } catch (err: any) {
    // Do not make the zgw methods fail due to this call
      logger.warn(`Retrieving already linked files for ${zaakUrl} failed.`);
      return [];
    }
  }
}