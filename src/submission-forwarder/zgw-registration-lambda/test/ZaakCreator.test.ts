import { Logger } from '@aws-lambda-powertools/logger';
import * as catalogi from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import { getAllPaginatedResults } from '@gemeentenijmegen/modules-zgw-client/lib/pagination-helper';
import * as zaken from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { Statics } from '../../../Statics';
import { CatalogiTypes } from '../CatalogiTypes';
import { zgwToday } from '../collaborators/Utils';
import { ZaakCreator, ZaakCreatorConfig } from '../collaborators/ZaakCreator';
import { ZGWRegistrationSubmission } from '../ZGWRegistrationSubmission';


jest.mock('@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client');
jest.mock('@gemeentenijmegen/modules-zgw-client/lib/pagination-helper');
jest.mock('@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client');

describe('ZaakCreator', () => {
  let mockClient: any;
  let mockCatalogi: Partial<CatalogiTypes>;
  let mockLogger: Logger;
  let creator: ZaakCreator;

  beforeEach(() => {
    mockClient = {} as any;
    mockCatalogi = {
      getLatestZaaktypeWithVersionData: jest.fn(),
    };
    mockLogger = new Logger() as any;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    const config: ZaakCreatorConfig = {
      zakenClient: mockClient,
      catalogiTypes: mockCatalogi as CatalogiTypes,
      logger: mockLogger,
    };
    creator = new ZaakCreator(config);
  });

  describe('createZaak', () => {
    it('should return existing zaak url if zaak exists', async () => {
      const submission: ZGWRegistrationSubmission = {
        reference: 'REF1',
        zaaktypeIdentificatie: 'ZT1',
        formName: 'Form1',
      } as any;

      // pagination returns existing zaak
      (getAllPaginatedResults as jest.Mock).mockResolvedValue([{ url: 'http://zaak/1' }]);
      const ZakenCtor = (zaken.Zaken as jest.Mock).mockImplementation(() => ({
        zaakList: jest.fn(),
      }));

      const result = await creator.createZaak(submission);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('already exists'),
      );
      expect(result).toBe('http://zaak/1');

      expect(ZakenCtor).toHaveBeenCalledWith(mockClient);
    });

    it('should throw if existing zaak missing url', async () => {
      const submission = {
        reference: 'REF2',
        zaaktypeIdentificatie: 'ZT2',
        formName: 'F2',
      } as any;
      (getAllPaginatedResults as jest.Mock).mockResolvedValue([{}]);
      (zaken.Zaken as jest.Mock).mockImplementation(() => ({ zaakList: jest.fn() }));

      await expect(creator.createZaak(submission))
        .rejects.toThrow(/exists, but does not have an url/);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('exists, but does not have an url'),
      );
    });

    it('should create a new zaak and return url', async () => {
      const submission = {
        reference: 'REF3',
        zaaktypeIdentificatie: 'ZT3',
        formName: 'My very long form name that gets truncated if over eighty characters'.repeat(2),
      } as any;

      (getAllPaginatedResults as jest.Mock).mockResolvedValue([]);
      const fakeZaakType = { latestZaaktype: { url: 'zt-url' } } as catalogi.ZaakType & any;
      (mockCatalogi.getLatestZaaktypeWithVersionData as jest.Mock)
        .mockResolvedValue(fakeZaakType);

      const mockZaakApi = {
        zaakCreate: jest.fn().mockResolvedValue({ data: { url: 'http://new/zaak' } }),
      };
      (zaken.Zaken as jest.Mock).mockImplementation(() => mockZaakApi);

      const result = await creator.createZaak(submission);
      expect(mockCatalogi.getLatestZaaktypeWithVersionData)
        .toHaveBeenCalledWith('ZT3');
      expect(mockZaakApi.zaakCreate).toHaveBeenCalledWith({
        identificatie: 'REF3',
        zaaktype: 'zt-url',
        omschrijving: submission.formName.slice(0, 79),
        startdatum: zgwToday,
        bronorganisatie: Statics.GN_RSIN,
        verantwoordelijkeOrganisatie: Statics.GN_RSIN,
      });
      expect(result).toBe('http://new/zaak');
    });
  });
});
