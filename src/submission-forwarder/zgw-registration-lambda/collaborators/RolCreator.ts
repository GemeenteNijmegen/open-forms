import { Logger } from '@aws-lambda-powertools/logger';
import * as catalogi from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import * as zaken from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { HttpClient as ZakenHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { CatalogiTypes } from '../CatalogiTypes';
import { ZGWRegistrationSubmission } from '../ZGWRegistrationSubmission';

let logger: Logger;

export interface RolCreatorConfig {
  zakenClient: ZakenHttpClient;
  catalogiTypes: CatalogiTypes;
  logger?: Logger;
}

export class RolCreator {
  private zakenClient: ZakenHttpClient;
  private catalogiTypes: CatalogiTypes;
  constructor(config: RolCreatorConfig) {
    this.zakenClient = config.zakenClient;
    this.catalogiTypes = config.catalogiTypes;
    logger = config.logger ?? new Logger();
  }

  /**
   * Set initiator rol if submission has bsn or kvk
   * The Rol can have iniator or Initiator, case insensitive in open-zaak
     * @param submission: ZGWRegistationSubmission
     * @param zaakUrl: string
     */
  async setInitiatorRol(submission: ZGWRegistrationSubmission, zaakUrl: string): Promise<void> {
    if (submission.bsn || submission.kvk) {
      logger.debug(`Submission ${submission.reference} has a ${submission.bsn ? 'BSN' : 'KVK'} create Initiator Rol.`);
      const rolProperties = submission.bsn ?
        {
          betrokkeneType: zaken.BetrokkeneTypeEnum.NatuurlijkPersoon,
          betrokkeneIdentificatie: { inpBsn: submission.bsn },
        }:
        {
          betrokkeneType: zaken.BetrokkeneTypeEnum.NietNatuurlijkPersoon,
          betrokkeneIdentificatie: { innNnpId: submission.kvk },
        };
      await this.setRol(submission, zaakUrl, 'Initiator', rolProperties);
    } else {
      logger.info(`No rol set due to no bsn or kvk present for ${submission.reference} ${submission.zaaktypeIdentificatie}`);
    }
  }

  // Partner rol mede-initiator kan hier ook gezet worden indien nodig

  async setRol(submission: ZGWRegistrationSubmission, zaakUrl: string, rolOmschrijvingGeneriek: string, rolProperties?: any): Promise<void> {
    const roltype: catalogi.RolType | undefined = await this.catalogiTypes.getRolTypeByOmschrijvingGeneriek(
      submission.zaaktypeIdentificatie,
      rolOmschrijvingGeneriek,
    );
    if (!roltype) {
      const errorMessage = `RolType could not be retrieved. Check your code or zaaktype in open zaak. ${rolOmschrijvingGeneriek} could not be found for ${submission.zaaktypeIdentificatie}. Please make sure the rest of this submission was processed correctly ${submission.reference}`;
      logger.error(errorMessage);
      throw Error(errorMessage);
    }
    const rolApi = new zaken.Rollen(this.zakenClient);
    const baseRol = {
      zaak: zaakUrl,
      roltype: roltype.url,
      roltoelichting: submission.zaaktypeIdentificatie,
    };
    const bodyRol = { ...baseRol, rolProperties };

    logger.debug('Before rolCreate', { bodyRol });
    const createdRol = await rolApi.rolCreate(bodyRol as Partial<zaken.Rol>);
    logger.debug(`Created the Rol: ${JSON.stringify(createdRol.data)}`);

  }
}