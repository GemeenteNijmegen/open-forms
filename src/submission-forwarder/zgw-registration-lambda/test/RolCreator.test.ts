
import { Logger } from '@aws-lambda-powertools/logger';
import * as catalogi from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import * as zaken from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { CatalogiTypes } from '../CatalogiTypes';
import { RolCreator, RolCreatorConfig } from '../collaborators/RolCreator';
import { ZGWRegistrationSubmission } from '../ZGWRegistrationSubmission';

jest.mock('@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client');
jest.mock('@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client');

describe('RolCreator', () => {
  let mockZakenClient: any;
  let mockCatalogiTypes: Partial<CatalogiTypes>;
  let mockLogger: Logger;
  let creator: RolCreator;

  beforeEach(() => {
    mockZakenClient = {} as any;
    mockCatalogiTypes = {
      getRolTypeByOmschrijvingGeneriek: jest.fn(),
    };
    mockLogger = new Logger() as any;
    mockLogger.debug = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();
    const config: RolCreatorConfig = {
      zakenClient: mockZakenClient,
      catalogiTypes: mockCatalogiTypes as CatalogiTypes,
      logger: mockLogger,
    };
    creator = new RolCreator(config);
  });

  describe('setInitiatorRol', () => {
    it('should set initiator when submission has bsn', async () => {
      const submission: ZGWRegistrationSubmission = {
        reference: 'ref123',
        zaaktypeIdentificatie: 'Z123',
        bsn: '99999',
      } as any;
      const fakeRolType = { url: 'roltype-url' } as catalogi.RolType;
      (mockCatalogiTypes.getRolTypeByOmschrijvingGeneriek as jest.Mock).mockResolvedValue(fakeRolType);

      const mockRolApi = {
        rolCreate: jest.fn().mockResolvedValue({ data: { id: 'role-1' } }),
      };
      (zaken.Rollen as jest.Mock).mockImplementation(() => mockRolApi);

      await creator.setInitiatorRol(submission, 'zaak://1');

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Submission ref123 has a BSN'));
      expect(mockCatalogiTypes.getRolTypeByOmschrijvingGeneriek)
        .toHaveBeenCalledWith('Z123', 'initiator');
      expect(mockRolApi.rolCreate).toHaveBeenCalledWith(expect.objectContaining({
        zaak: 'zaak://1',
        roltype: 'roltype-url',
        roltoelichting: 'Z123',
        betrokkeneType: zaken.BetrokkeneTypeEnum.NatuurlijkPersoon,
        betrokkeneIdentificatie: { inpBsn: '99999' },
      }));
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Created the Rol'));
    });

    it('should set initiator when submission has kvk', async () => {
      const submission = {
        reference: 'ref456',
        zaaktypeIdentificatie: 'Z456',
        kvk: '12345',
      } as any;
      const fakeRolType = { url: 'roltype-url-kvk' } as catalogi.RolType;
      (mockCatalogiTypes.getRolTypeByOmschrijvingGeneriek as jest.Mock).mockResolvedValue(fakeRolType);
      const mockRolApi = { rolCreate: jest.fn().mockResolvedValue({ data: {} }) };
      (zaken.Rollen as jest.Mock).mockImplementation(() => mockRolApi);

      await creator.setInitiatorRol(submission, 'zaak://2');

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('has a KVK'));
      expect(mockRolApi.rolCreate).toHaveBeenCalledWith(expect.objectContaining({
        betrokkeneType: zaken.BetrokkeneTypeEnum.NietNatuurlijkPersoon,
        betrokkeneIdentificatie: { innNnpId: '12345' },
      }));
    });

    it('should not set initiator when no bsn or kvk', async () => {
      const submission = {
        reference: 'ref789',
        zaaktypeIdentificatie: 'Z789',
      } as any;

      await creator.setInitiatorRol(submission, 'zaak://3');

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('No rol set due to no bsn or kvk'));
      expect(mockCatalogiTypes.getRolTypeByOmschrijvingGeneriek).not.toHaveBeenCalled();
    });
  });

  describe('setRol error cases', () => {
    it('should throw if rolType not found', async () => {
      const submission = {
        reference: 'ref000',
        zaaktypeIdentificatie: 'Z000',
      } as any;
      (mockCatalogiTypes.getRolTypeByOmschrijvingGeneriek as jest.Mock).mockResolvedValue(undefined);

      await expect(creator.setRol(submission, 'zaak://x', 'initiator'))
        .rejects.toThrow(/RolType could not be retrieved/);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('RolType could not be retrieved'));
    });
  });
});
