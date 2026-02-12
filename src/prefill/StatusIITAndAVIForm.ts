
import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Bsn } from '@gemeentenijmegen/utils';
import { z } from 'zod';
import { prefillProps } from './handlePrefillRequest';
/**
 * Class retrieves and processes the current IIT and AVI state for the IIT form
 * The ESB call checks MW_IIT Table for
 * sofinummer_client OR sofinummer_partner is participatieWetKlant
 * receivedAvi based on NuIITBedrag above 0
 * hadRecentIIT based on VorigePeriodeIIT as a numer jjjjmm
 * Only BSN can be processed.
 * Data for form is extra information. Errors should not stop form from being rendered.
 * IIT - Individuele Inkomenstoeslag
 * AVI - Ambtshalve Verstrekking IIT
 */
export class StatusIITAndAVIForm {

  private apiClient: ApiClient;
  private esbResponse?: any;

  constructor(props: prefillProps) {
    this.apiClient = props.apiClient;
  }
  async requestData(identifier: Bsn | string, userType: 'person' | 'organisation'): Promise<any> {
    if (userType != 'person' || !(identifier instanceof Bsn)) {
      console.error('[StatusIITAndAviForm] Only natural persons can fill out statusform');
      return {};
    } if (!identifier) {
      console.error('[StatusIITAndAviForm] No bsn present in prefillHandler');
      return {};
    }
    try {
      // apiClient already has certificates
      const api = new Api(this.apiClient);
      const response = await api.getData(identifier);
      this.processResponse(response);
    } catch (error: any) {
      console.error('[StatusIITAndAviForm]', error);
    }
    if (this.esbResponse?.ParticipatieWetKlant !== undefined) {
      // Got a response and bsn shows person is ParticipatieWetKlant
      const prefillResponse = this.prepareOutputData(this.esbResponse);
      return prefillResponse;
    } else {
      // Nothing should happen in the form
      console.error('[StatusIITAndAviForm] esbResponse is undefined and should be true or false.');
      return {
        participatieWetKlant: false,
      };
    }
  }
  private prepareOutputData(esbResponse: any): outputData {
    const participatieWetKlant = typeof esbResponse.ParticipatieWetKlant === 'boolean' ? esbResponse.ParticipatieWetKlant : false;
    if (!participatieWetKlant) return { participatieWetKlant };
    //return typeof value === 'boolean' ? value.toString() : "false";
    const receivedAvi = typeof esbResponse.NuBedragIIT === 'boolean' ? esbResponse.NuBedragIIT : false;
    // Determine hadRecentIIT based on VorigePeriodeIITBinnenElfMaanden
    const hadRecentIIT = typeof esbResponse.VorigePeriodeIITBinnenElfMaanden === 'boolean' ? esbResponse.VorigePeriodeIITBinnenElfMaanden : false;

    // Determine lastIIT based on VorigePeriodeIIT
    let lastIIT: undefined | lastIITPeriod = undefined;

    lastIIT = this.formatLastIIT(esbResponse);

    return {
      participatieWetKlant,
      receivedAvi,
      hadRecentIIT,
      ...(lastIIT !== undefined && { lastIIT }), // Only include lastIIT if it has a value
    };
  }

  private formatLastIIT(esbResponse: any): undefined | lastIITPeriod {
    if (!esbResponse.VorigePeriodeIIT || esbResponse.VorigePeriodeIIT === 'undefined') return undefined;
    // toString in case it is a number
    const period: string = esbResponse.VorigePeriodeIIT.toString();
    // check if the string has a JJJJMM format
    if (!period.match(/^\d{4}(0[1-9]|1[0-2])$/)) return undefined;

    const yearSubstring = period.substring(0, 'jjjj'.length);
    const monthSubstring = period.substring(4, 4 + 'mm'.length );
    const lastIIT = {
      year: yearSubstring,
      month: monthSubstring,
      monthName: getDutchMonthName(monthSubstring) ?? '',
    };

    return lastIIT;
  }

  private processResponse(data: any) {
    try {
      this.esbResponse = iitAviFormulierESBSchema.parse(data);
    } catch (error) {
      console.error('[StatusIITAndAviForm] Error processing response', error, data);
    }
  }
}

class Api {
  private endpoint?: string;
  private client: ApiClient;
  constructor(client: ApiClient, providedEndpoint?: string) {
    this.endpoint = providedEndpoint ?? process.env.IIT_AVI_PREFILL_ENDPOINT;
    if (!this.endpoint) {
      throw Error('[StatusIITAndAviForm] You must provide an endpoint in the constructor or as environment variable `IIT_AVI_PREFILL_ENDPOINT`.');
    }
    this.client = client ? client : new ApiClient();
    client.setTimeout(8000);
  }

  async getData(bsn: Bsn) {
    try {
      if (!this.endpoint) { throw Error('[StatusIITAndAviForm] Endpoint should be set at this point'); }
      // bsn input as header
      let data = await this.client.getData(this.endpoint, {
        'Content-type': 'application/json',
        'bsn': bsn.bsn,
      });
      return data;
    } catch (error: any) {
      const data = {
        error: error.message,
      };
      return data;
    }
  }

}

/**
 * Verwachte response van ESB
 * Indien een veld leeg is geven ze 'undefined' als string terug
 */
export const iitAviFormulierESBSchema = z.object({
  ParticipatieWetKlant: z.union([z.boolean(), z.string()]).optional(),
  NuBedragIIT: z.union([z.boolean(), z.string()]).optional(), // Is altijd boolean of undefined als string
  VorigePeriodeIIT: z.union([z.string(), z.number()]).optional().nullable(), // Kan ook null zijn
  VorigePeriodeIITBinnenElfMaanden: z.union([z.boolean(), z.string()]).optional(),
});

export const getDutchMonthName = (month: string): string => {
  const date = new Date(`2000-${month}-01`); // Year 2000 is arbitrary
  return date.toLocaleString('nl-NL', { month: 'long' });
};

// Data die door het formulier gebruikt kan worden in formconfig
export interface outputData {
  participatieWetKlant: boolean;
  receivedAvi?: boolean;
  hadRecentIIT?: boolean;
  lastIIT?: lastIITPeriod;
}
export interface lastIITPeriod {
  year: string;
  month: string;
  monthName: string;
}
