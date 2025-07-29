import { Logger } from '@aws-lambda-powertools/logger';
import * as catalogi from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import { getAllPaginatedResults } from '@gemeentenijmegen/modules-zgw-client/lib/pagination-helper';
import * as zaken from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { HttpClient as ZakenHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { Statics } from '../../../Statics';
import { CatalogiTypes } from '../CatalogiTypes';
import { ZGWRegistrationSubmission } from '../ZGWRegistrationSubmission';
import { zgwToday } from './Utils';

let logger: Logger;

export interface ZaakCreatorConfig {
  zakenClient: ZakenHttpClient;
  catalogiTypes: CatalogiTypes;
  logger?: Logger;
}

export class ZaakCreator {
  private zakenClient: ZakenHttpClient;
  private catalogiTypes: CatalogiTypes;
  constructor(config: ZaakCreatorConfig) {
    this.zakenClient = config.zakenClient;
    this.catalogiTypes = config.catalogiTypes;
    logger = config.logger ?? new Logger();
  }

  /**
   * creates a zaak if it does not exist right now
   * @param submission ZGWRegistationSubmission
   * @returns zaakurl of created zaak
  */
  async createZaak(submission: ZGWRegistrationSubmission): Promise<string> {
    const zaakApi = new zaken.Zaken(this.zakenClient);
    const zaakExists = await getAllPaginatedResults(zaakApi.zaakList, { identificatie: submission.reference });

    if (zaakExists.length != 0) {
      logger.warn(`Zaak ${submission.reference} of type ${submission.zaaktypeIdentificatie} already exists ${zaakExists.length}`);
      if (!zaakExists[0].url) {
        const errorMessage = `Zaak ${submission.reference} exists, but does not have an url for some strange reason. Zaak cannot be added or changed.`;
        logger.error(errorMessage);
        throw Error(errorMessage);
      }
      return zaakExists[0].url;
    }
    // Zaak does not exist, should be created and url returned.

    logger.debug(`Get zaaktype with identificatie ${submission.zaaktypeIdentificatie}`);
    const zaaktype: catalogi.ZaakType = (await this.catalogiTypes.getLatestZaaktypeWithVersionData(submission.zaaktypeIdentificatie)).latestZaaktype;

    logger.debug(`Before zaakCreate ${submission.reference}`);

    const createdZaak = await zaakApi.zaakCreate({
      identificatie: submission.reference, // OF-....
      zaaktype: zaaktype.url,
      omschrijving: submission.formName.slice(0, 79), // Max 80 chars displayname
      startdatum: zgwToday,
      bronorganisatie: Statics.GN_RSIN,
      verantwoordelijkeOrganisatie: Statics.GN_RSIN,
    });

    const zaakurl = createdZaak.data.url;
    logger.debug(`Zaakcreate done ${zaakurl} for ${submission.reference}`);

    return zaakurl;
  }
}