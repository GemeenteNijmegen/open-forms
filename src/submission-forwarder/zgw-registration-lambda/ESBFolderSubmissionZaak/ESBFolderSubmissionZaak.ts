import { Logger } from '@aws-lambda-powertools/logger';
import { HttpClient as CatalogiHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import * as catalogi from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import { HttpClient as ZakenHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import * as zaken from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { BetrokkeneTypeEnum } from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client/1.4.1';
import { Submission } from '../../shared/Submission';
import { ZgwClientFactory } from '../../shared/ZgwClientFactory';
import { CatalogusTypes } from '../CatalogusTypes';

/**
 * A folder submission Zaak is a submission - aanvraag - in open forms
 * That will be stored by the ESB in the designated folder
 * A zaak will be created for this type of submission in mijn services open zaak
 * Creates zaak, adds Status, initator Rol and adds submission files
 */

interface ESBFolderSubmissionZaakOptions {
  zgwClientFactory: ZgwClientFactory;
  zakenApiBaseUrl: string;
  catalogiApiBaseUrl: string;
  logger?: Logger;
}

export class ESBFolderSubmissionZaak {
  /**
   * Factory method that handles async initialization
   */
  static async create(
    options: ESBFolderSubmissionZaakOptions,
  ): Promise<ESBFolderSubmissionZaak> {
    const logger = options.logger ?? new Logger();
    try {
      const zakenClient = await options.zgwClientFactory.getZakenClient(
        options.zakenApiBaseUrl,
      );
      const catalogiClient = await options.zgwClientFactory.getCatalogiClient(
        options.catalogiApiBaseUrl,
      );
      logger.debug('ESBFolderSubmission created');
      return new ESBFolderSubmissionZaak(
        zakenClient,
        catalogiClient,
        logger,
      );
    } catch (err: any) {
      throw Error(
        `Creating ESBFolderSubmissionZaak failed ${err instanceof Error ? err.stack : JSON.stringify(err)
        }`,
      );
    }
  }


  readonly ZAAKTYPE_IDENTIFICATIE = 'OF-ESB-FOLDERS';
  readonly ROL_OMSCHRIJVING_GENERIEK = 'initiator'; // enum field value
  readonly GN_RSIN = '001479179';

  private constructor(
    private readonly zakenHttpClient: ZakenHttpClient,
    private readonly catalogiHttpClient: CatalogiHttpClient,
    private readonly logger: Logger,
  ) {}

  public get zakenClient(): ZakenHttpClient {
    return this.zakenHttpClient;
  }

  public get catalogiClient(): CatalogiHttpClient {
    return this.catalogiHttpClient;
  }


  public async createEsbFolderZaak(submission: Submission) {
    // In kleine stukjes/classes hakken
    this.logger.appendKeys({ reference: submission.reference });
    this.logger.debug('createEsbFolderZaak');


    const zaakApi = new zaken.Zaken(this.zakenHttpClient);
    const zaakExists = await zaakApi.zaakList({ identificatie: submission.reference });
    if (zaakExists.data.count != 0) {
      this.logger.warn(`Zaak ${submission.reference} already exists ${zaakExists.data.count}`);
      // Should stop here, or only add status/rol
    }
    const { zaaktype, statustype, roltype } = await this.getCatalogusTypes();
    const zgwToday = new Date().toISOString().substring(0, 'yyyy-mm-dd'.length);
    const createdZaak = await zaakApi.zaakCreate({
      identificatie: submission.reference, // OF-....
      zaaktype: zaaktype.url,
      omschrijving: submission.formName.slice(0, 79), // Max 80 chars displayname
      startdatum: zgwToday,
      bronorganisatie: this.GN_RSIN,
      verantwoordelijkeOrganisatie: this.GN_RSIN,
    });
    const zaakurl = createdZaak.data.url;
    if (statustype) {
      const statusApi = new zaken.Statussen(this.zakenClient);
      const createdStatus = await statusApi.statusCreate({
        zaak: zaakurl,
        statustype: statustype.url,
        datumStatusGezet: zgwToday,
      });
      this.logger.debug(`Created the Status: ${createdStatus.data.uuid}`);
    }
    if (roltype) {
      // Hier gaan nog dingen mis het Rol type in de modules door de verschillende varianten
      const rolApi = new zaken.Rollen(this.zakenClient);
      const createdRol = await rolApi.rolCreate({
        zaak: zaakurl,
        roltype: roltype.url,
        betrokkeneType: BetrokkeneTypeEnum.NatuurlijkPersoon,
        roltoelichting: 'maak hier een betere toelichting van',
      } as Partial<zaken.Rol>);
      this.logger.debug(`Created the Rol: ${createdRol.data}`);
    }

    // Add informatieobjecten to zaak
    const zaakInformatieObjectApi = new zaken.Zaakinformatieobjecten(this.zakenClient);
    const addedPdf = await zaakInformatieObjectApi.zaakinformatieobjectCreate({
      zaak: zaakurl,
      informatieobject: submission.pdf,
    });
    this.logger.debug('Addded pdf to zaak', { addedPdf });

    // Or promise all for parallel
    for (const attachment of submission.attachments ?? []) {
      const added = await zaakInformatieObjectApi.zaakinformatieobjectCreate({
        zaak: zaakurl,
        informatieobject: attachment,
      });
      this.logger.debug('Added attachment to zaak', { added });
    }


  }


  private async getCatalogusTypes() {
    const catalogusType = new CatalogusTypes({ catalogiClient: this.catalogiClient, logger: this.logger });
    this.logger.debug('getCatalogusTypes');
    const zaaktype: catalogi.ZaakType = (await catalogusType.getLatestZaaktypeWithVersionData(this.ZAAKTYPE_IDENTIFICATIE)).latestZaaktype;
    const statustype: catalogi.StatusType | undefined = await catalogusType.getFirstStatusType(this.ZAAKTYPE_IDENTIFICATIE);
    const roltype: catalogi.RolType | undefined = await catalogusType.getRolTypeByOmschrijvingGeneriek(
      this.ZAAKTYPE_IDENTIFICATIE,
      this.ROL_OMSCHRIJVING_GENERIEK,
    );
    this.logger.debug(`
      getCatalogusTypes done ${zaaktype.omschrijving}, 
      ${statustype ? statustype.omschrijving : 'statusType undefined'},
      ${roltype ? roltype.omschrijving : 'roltype undefined'}
      `);
    return { zaaktype, statustype, roltype };
  }
  /**
   * TODO: in kleinere bestanden opdelen
   */


  // ZAKEN
  // Check of zaak al bestaat, anders voeg zaak toe met OF-... identificatie
  // Stel status in
  // Voeg roltype toe met bsn/kvk (later mail / telefoon)
  // Koppel docs uit submission aan zaak

  //Foutafhandeling en duidelijke errors

  // Grote TODO: waar schrijven we de formName weg in de zaak om in Mijn Nijmegen op te pakken
  // Omschrijving in zaak - 1 call (zaakeigenschap vereist meerdere calls) en max 80 chars. Stel we hebben meer chars nodig, wellicht toelichting 1000 chars max.
}
