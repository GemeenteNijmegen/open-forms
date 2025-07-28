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
   * The Rol can have should have initiator with small caps when creating, even though open-zaak has a capital letter Initiator
     * @param submission: ZGWRegistationSubmission
     * @param zaakUrl: string
     */
  async setInitiatorRol(submission: ZGWRegistrationSubmission, zaakUrl: string): Promise<void> {
    const INITIATOR_ROL_OMSCHRIJVING_GENERIEK = 'initiator';
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
      await this.setRol(submission, zaakUrl, INITIATOR_ROL_OMSCHRIJVING_GENERIEK, rolProperties);
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
    const rolExists = await rolApi.rolList({ zaak: zaakUrl, roltype: roltype.url });
    if (rolExists.data.count != 0) {
      logger.info('Rol was already set. Do not set again ', { results: rolExists.data.results?.[0] });
      return;
    }

    const baseRol = {
      zaak: zaakUrl,
      roltype: roltype.url,
      roltoelichting: submission.zaaktypeIdentificatie,
    };
    const bodyRol = { ...baseRol, ...rolProperties };

    logger.debug('Before rolCreate', { bodyRol });
    try {
      const createdRol = await rolApi.rolCreate(bodyRol as Partial<zaken.Rol>);
      logger.debug(`Created the Rol: ${JSON.stringify(createdRol.data)}`);
    } catch (err: any) {
      // in Open-Zaak kvkNummer is experimenteel and should be used instead of innNnpId, because it results in a validation error
      // https://github.com/open-zaak/open-zaak/blame/025076f89405110d0f7e3c56d052a257099b5fdb/src/openzaak/components/zaken/models/zaken.py#L1154
      // The RSIN validation expects at least 9 chars and kvkNummer is 8 chars

      if (bodyRol.betrokkeneIdentificatie.innNnpId) {
        logger.debug('Use experimental kvkNummer in betrokkeneIdentificatie instead of RSIN');
        const retryBodyRol = structuredClone(bodyRol);
        retryBodyRol.betrokkeneIdentificatie.kvkNummer = bodyRol.betrokkeneIdentificatie.innNnpId;
        retryBodyRol.betrokkeneIdentificatie.innNnpId = undefined;
        logger.debug('Before retry rolCreate with kvkNummer', { retryBodyRol });
        const createdRol = await rolApi.rolCreate(retryBodyRol as Partial<zaken.Rol>);
        logger.debug(`Created the Rol: ${JSON.stringify(createdRol.data)}`);
      } else {
        throw Error(err);
      };
    }


  }
}