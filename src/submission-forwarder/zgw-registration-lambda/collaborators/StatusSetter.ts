import { Logger } from '@aws-lambda-powertools/logger';
import * as catalogi from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import * as zaken from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { HttpClient as ZakenHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { CatalogiTypes } from '../CatalogiTypes';
import { ZGWRegistrationSubmission } from '../ZGWRegistrationSubmission';
import { zgwToday } from './Utils';

let logger: Logger;

export interface StatusSetterConfig {
  zakenClient: ZakenHttpClient;
  catalogiTypes: CatalogiTypes;
  logger?: Logger;
}

export class StatusSetter {
  private zakenClient: ZakenHttpClient;
  private catalogiTypes: CatalogiTypes;
  constructor(config: StatusSetterConfig) {
    this.zakenClient = config.zakenClient;
    this.catalogiTypes = config.catalogiTypes;
    logger = config.logger ?? new Logger();
  }

  /**
     * @param submission: ZGWRegistationSubmission
     * @param zaakUrl: string
     */
  async setFirstStatus(submission: ZGWRegistrationSubmission, zaakUrl: string): Promise<void> {
    const firstStatusType: catalogi.StatusType | undefined = await this.catalogiTypes.getFirstStatusType(submission.zaaktypeIdentificatie);

    if (firstStatusType) {
      const statusApi = new zaken.Statussen(this.zakenClient);
      logger.debug('Before statusCreate');
      const createdStatus = await statusApi.statusCreate({
        zaak: zaakUrl,
        statustype: firstStatusType.url,
        datumStatusGezet: zgwToday,
      });
      logger.debug(`Created the Status: ${createdStatus.data.uuid} ${createdStatus.data.statustoelichting}`);
    } else {
      logger.warn(`No firstStatus set because of an empty statusType for ${submission.reference} ${submission.zaaktypeIdentificatie}`);
    }
  }
}