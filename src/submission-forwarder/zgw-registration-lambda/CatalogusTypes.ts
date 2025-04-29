import { Logger } from '@aws-lambda-powertools/logger';
import { HttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import * as catalogi from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import { getAllPaginatedResults } from '@gemeentenijmegen/modules-zgw-client/lib/pagination-helper';

export interface CatalogusTypesConfig {
  catalogiClient: HttpClient;
  logger?: Logger;
}

/**
 * Might need rename and refactor
 * Get catalogus types such as zaaktype, roltype and statustype
 * Structure the class so it can preload
 */
export class CatalogusTypes {
  private client: HttpClient;
  private logger: Logger;
  constructor(config: CatalogusTypesConfig) {
    this.client = config.catalogiClient;
    this.logger = config.logger ?? new Logger();
  }
  public async getCatalogusTypeOverview() {
    // identificatie, zaakurl, statustype url, roltype voor nu

  }

  /**
   * Fetches all Zaaktypes that match the given identificatie (across all pages).
   */
  public async fetchZaaktypesByIdentificatie(
    identificatie: string,
  ): Promise<catalogi.ZaakType[]> {
    const api = new catalogi.Zaaktypen(this.client);
    // We pass the query param { identificatie } to filter by identificatie
    const allZaaktypes = await getAllPaginatedResults(api.zaaktypeList, {
      identificatie,
    });
    return allZaaktypes;
  }

  /**
   * Returns both:
   *  - The latest Zaaktype (by versiedatum).
   *  - A list of version metadata (versiedatum, beginGeldigheid, eindeGeldigheid) for *all* versions.
   */
  public async getLatestZaaktypeWithVersionData(
    identificatie: string,
  ): Promise<{
      latestZaaktype: catalogi.ZaakType;
      versions: Array<{
        versiedatum: string;
        datumBeginGeldigheid: string;
        datumEindeGeldigheid?: string;
      }>;
    }> {
    const zaaktypes = await this.fetchZaaktypesByIdentificatie(identificatie);
    if (!zaaktypes || zaaktypes.length === 0) {
      this.logger.error( `Geen zaaktypes gevonden voor identificatie: ${identificatie}`, 'CatalogusTypes getLatestZaaktypeWithVersionData');
      throw new Error(
        `Geen zaaktypes gevonden voor identificatie: ${identificatie}`,
      );
    }
    // Sort by versiedatum descending
    const sorted = zaaktypes.sort(
      (a, b) =>
        new Date(b.versiedatum).getTime() - new Date(a.versiedatum).getTime(),
    );

    const latestZaaktype = sorted[0];
    const versions = sorted.map((zt) => ({
      versiedatum: zt.versiedatum ?? '',
      datumBeginGeldigheid: zt.beginGeldigheid ?? '',
      datumEindeGeldigheid: zt.eindeGeldigheid ?? '',
    }));

    this.logger.debug(`CatalogusTypes getLatestZaaktypeWithVersionData for ${identificatie}`, { versions });
    return {
      latestZaaktype,
      versions,
    };
  }

  //   public async getStatusTypeByOmschrijving(omschrijving: string, identificatie: string){
  //     this.logger.debug(`getStatusTypeByOmschrijving ${omschrijving} for ${identificatie}`);
  //     const api = new catalogi.Statustypen(this.client);
  //     // We pass the query param { identificatie } to filter by identificatie
  //     const allStatustypen = await getAllPaginatedResults(api.statustypeList, {
  //       zaaktypeIdentificatie: identificatie
  //     });
  //     this.logger.debug(`allStatustypen`, {allStatustypen});
  //   }
  public async getFirstStatusType(zaaktypeIdentificatie: string) {
    this.logger.debug(`getFirstStatusType for ${zaaktypeIdentificatie} first volgnummer`);
    const api = new catalogi.Statustypen(this.client);
    // We pass the query param { identificatie } to filter by identificatie
    const allStatustypen = await getAllPaginatedResults(api.statustypeList, {
      zaaktypeIdentificatie: zaaktypeIdentificatie,
    });
    if (!allStatustypen || allStatustypen.length === 0) {
      this.logger.error(`getFirstStatusType ${zaaktypeIdentificatie} returned no statusTypen at all`);
      return undefined;
    }
    this.logger.debug('allStatustypen', { allStatustypen });

    // Get statusType based on lowest volgnummer
    const firstStatusType = allStatustypen.reduce(
      (lowestStatusType, currentStatusType) =>
        currentStatusType.volgnummer < lowestStatusType.volgnummer ? currentStatusType : lowestStatusType,
    );

    // Even though business logic should not allow multiple Statussen with the same volgnummer, a check for now
    const volgnummerCount = allStatustypen.filter(st => st.volgnummer == firstStatusType.volgnummer).length;
    this.logger.debug(`Amount of first volgnummers ${volgnummerCount} for volgnummer ${firstStatusType.volgnummer} of ${firstStatusType.omschrijving} of ${zaaktypeIdentificatie}`);

    return firstStatusType;
  }

  public async getRolTypeByOmschrijvingGeneriek(zaaktypeIdentificatie: string, omschrijvingGeneriek: string = 'initiator') {
    this.logger.debug(`getRolTypeByOmschrijvingGeneriek for ${zaaktypeIdentificatie} with omschrijvingGeneriek ${omschrijvingGeneriek}`);
    const api = new catalogi.Roltypen(this.client);
    // We pass the query param { identificatie } to filter by identificatie
    const allRoltypen = await getAllPaginatedResults(api.roltypeList, {
      zaaktypeIdentificatie: zaaktypeIdentificatie,
      omschrijvingGeneriek: omschrijvingGeneriek,
    });
    if (!allRoltypen || allRoltypen.length === 0) {
      this.logger.error(`getRolTypeByOmschrijvingGeneriek ${zaaktypeIdentificatie} ${omschrijvingGeneriek} returned no Roltypen at all`);
      return undefined;
    }
    if (allRoltypen.length > 1) {
      this.logger.warn(`More than one roltype returned getRolTypeByOmschrijvingGeneriek ${zaaktypeIdentificatie} ${omschrijvingGeneriek}`);
      this.logger.debug('all results', { allRoltypen });
    }
    this.logger.debug(`roltype ${omschrijvingGeneriek} ${allRoltypen[0]}`);
    return allRoltypen[0];
  }
}
