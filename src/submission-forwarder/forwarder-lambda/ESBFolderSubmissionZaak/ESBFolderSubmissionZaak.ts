import { HttpClient as CatalogiHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import { HttpClient as ZakenHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { Submission } from '../../shared/Submission';
import { ZgwClientFactory } from '../ZgwClientFactory';

/**
 * A folder submission Zaak is a submission - aanvraag - in open forms
 * That will be stored by the ESB in the designated folder
 * A zaak will be created for this type of submission in mijn services open zaak
 * Creates zaak, adds Status, initator Rol and adds submission files
 */

interface ESBFolderSubmissionZaakOptions {
  submission: Submission;
  zgwClientFactory: ZgwClientFactory;
  zakenApiBaseUrl: string;
  catalogiApiBaseUrl: string;
}

export class ESBFolderSubmissionZaak {
  /**
   * Factory method that handles async initialization
   */
  static async create(
    options: ESBFolderSubmissionZaakOptions,
  ): Promise<ESBFolderSubmissionZaak> {
    try {
      const zakenClient = await options.zgwClientFactory.getZakenClient(
        options.zakenApiBaseUrl,
      );
      const catalogiClient = await options.zgwClientFactory.getCatalogiClient(
        options.catalogiApiBaseUrl,
      );

      return new ESBFolderSubmissionZaak(
        options.submission,
        zakenClient,
        catalogiClient,
      );
    } catch (err: any) {
      // Add powertools logger
      throw Error(
        `Creating ESBFolderSubmissionZaak failed ${
          err instanceof Error ? err.stack : JSON.stringify(err)
        }`,
      );
    }
  }
  readonly ZAAKTYPE_IDENTIFICATIE = 'OF-ESB-FOLDERS';
  readonly ROL_OMSCHRIJVING_GENERIEK = 'initiator'; // enum field value

  private constructor(
    private readonly submission: Submission,
    private readonly zakenHttpClient: ZakenHttpClient,
    private readonly catalogiHttpClient: CatalogiHttpClient,
  ) {}

  public get zakenClient(): ZakenHttpClient {
    return this.zakenHttpClient;
  }

  public get catalogiClient(): CatalogiHttpClient {
    return this.catalogiHttpClient;
  }

  // Remove later on, prevents issues of unused property
  public getSubmission(): Submission {
    return this.submission;
  }

  /**
   * TODO: in kleinere bestanden opdelen
   */

  // CATALOGI
  // Get laatste versie zaaktype met ZAAKTYPE_IDENTIFICATIE
  // Get roltype met queryparam zaaktypeurl en rol omschrijving generiek
  // Get statustype met volgnummer 1

  // ZAKEN
  // Check of zaak al bestaat, anders voeg zaak toe met OF-... identificatie
  // Stel status in
  // Voeg roltype toe met bsn/kvk (later mail / telefoon)
  // Koppel docs uit submission aan zaak

  //Foutafhandeling en duidelijke errors

  // Grote TODO: waar schrijven we de formName weg in de zaak om in Mijn Nijmegen op te pakken
}
