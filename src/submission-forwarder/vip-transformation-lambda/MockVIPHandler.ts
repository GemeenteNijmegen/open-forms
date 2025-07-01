import { Logger } from '@aws-lambda-powertools/logger';

export type AppIdAttribute = string; // e.g. "APV", "JUR", …

export interface MockDefinition {
  /**
   * A prefix or full match against the incoming choice (all lowercased)
   * e.g. "vip" will match "vip01", "vip02", etc.
   */
  prefix: string;
  /** The JSON payload to return */
  data: any;
  /** The SNS AppId attribute to attach */
  attribute: AppIdAttribute;
}

export interface MockResult {
  body: any;
  attribute: AppIdAttribute;
}

export class MockVIPHandler {
  public static registerMock(def: MockDefinition): void {
    this.registry.unshift(def);
  }
  private static readonly registry: MockDefinition[] = [];

  private static registerDefaults(): void {
    this.registry.push({ prefix: 'vip01', data: vip01, attribute: 'APV' });
    this.registry.push({ prefix: 'jz01', data: jz01, attribute: 'JUR' });
  }

  private readonly logger = new Logger({ serviceName: 'MockVIPHandler' });

  constructor() {
    this.logger.info('MockVIPHandler initialized – serving static mock files');
    if (MockVIPHandler.registry.length === 0) {
      MockVIPHandler.registerDefaults();
    }
  }

  /**
   * Pick the first matching mock by prefix, or fallback to the last-registered default.
   * @param choice  e.g. "vip01" | "jz01" | "" | undefined | any other string
   */
  public handle(choice?: string): MockResult {
    this.logger.info('Start mock handler', { choice });
    const key = (choice ?? '').toLowerCase();

    const found = MockVIPHandler.registry.find((d) => key.startsWith(d.prefix));
    this.logger.info('Found with prefix?', {found});
    const def = found ?? MockVIPHandler.registry[MockVIPHandler.registry.length - 1]!;

    this.logger.debug('Selected mock', {
      prefix: def.prefix,
      attribute: def.attribute,
      dataSample: def.data,
    });

    return { body: def.data, attribute: def.attribute };
  }
}

export const jz01 = {
  reference: 'OF-D4CRFR',
  fileObjects: [
    {
      bucket: 'open-forms-main-stack-submissionforwardersubmissio-zwnxg2nji9fu',
      objectKey: 'jz4all/OF-D4CRFR/OF-D4CRFR.pdf',
      fileName: 'OF-D4CRFR.pdf',
      objectType: 'submission',
    },
    {
      bucket: 'open-forms-main-stack-submissionforwardersubmissio-zwnxg2nji9fu',
      objectKey: 'jz4all/OF-D4CRFR/bijlage_een.jpg',
      fileName: 'bijlage_een.jpg',
      objectType: 'attachment',
    },
  ],
  data: {
    isgemachtigde: '',
    naamIngelogdeGebruiker: 'Local Funzoom N.V.',
    inlogmiddel: 'eherkenning',
    vipZaaktype: '7562e893-3d95-4114-bceb-b3407346e4ff',
    opWelkeDatumHeeftDeGemeenteHetBesluitBekendGemaaktOfDeBeschikkingGegeven:
      '21-06-2025',
    welkKenmerkOfReferentienummerHeeftHetBesluitOfDeBeschikkingWaartegenUBezwaarMaakt:
      'weewrwer',
    eMailadres: 'testexample@nijmegen.nl',
    telefoonnummer: '061234567890',
  },
  kvknummer: '90004760',
};

export const vip01 = {
  reference: 'OF-CQDDBH',
  fileObjects: [
    {
      bucket: 'open-forms-main-stack-submissionforwardersubmissio-zwnxg2nji9fu',
      objectKey: 'vip/OF-CQDDBH/OF-CQDDBH.pdf',
      fileName: 'OF-CQDDBH.pdf',
      objectType: 'submission',
    },
    {
      bucket: 'open-forms-main-stack-submissionforwardersubmissio-zwnxg2nji9fu',
      objectKey: 'vip/OF-CQDDBH/bijlage_een.jpg',
      fileName: 'bijlage_een.jpg',
      objectType: 'attachment',
    },
  ],
  data: {
    vipZaaktype: '7562e893-3d95-4114-bceb-b3407346e4ff',
    isgemachtigde: '',
    isgemachtigde1: '',
    wiltUBezwaarMakenTegenBelastingen: 'nee',
    kenmerk: 'OF-CQDDBH',
    naamIngelogdeGebruiker: "S. van 't Hul",
    inlogmiddel: 'digid',
    bsn: '999971785',
    opWelkeDatumHeeftDeGemeenteHetBesluitBekendGemaaktOfDeBeschikkingGegeven:
      '20-06-2025',
    welkKenmerkOfReferentienummerHeeftHetBesluitOfDeBeschikkingWaartegenUBezwaarMaakt:
      'jkebwfhjerw',
    eMailadres: 'testexample@nijmegen.nl',
    telefoonnummer: '061234567890',
  },
  bsn: '999971785',
};
