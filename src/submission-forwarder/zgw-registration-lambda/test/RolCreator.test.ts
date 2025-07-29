import { Logger } from '@aws-lambda-powertools/logger';
import * as catalogi from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import * as zaken from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { CatalogiTypes } from '../CatalogiTypes';
import { RolCreator, RolCreatorConfig } from '../collaborators/RolCreator';
import { ZGWRegistrationSubmission } from '../ZGWRegistrationSubmission';

jest.mock('@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client');
jest.mock('@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client');

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

  it('should set initiator with BSN or KVK and call setRol correctly', async () => {
    const mockRolType = { url: 'rol-url' } as catalogi.RolType;
    (mockCatalogiTypes.getRolTypeByOmschrijvingGeneriek as jest.Mock).mockResolvedValue(mockRolType);

    const mockRolApi = {
      rolList: jest.fn().mockResolvedValue({ data: { count: 0 } }),
      rolCreate: jest.fn().mockResolvedValue({ data: { foo: 'bar' } }),
    };
    (zaken.Rollen as jest.Mock).mockImplementation(() => mockRolApi);

    const submissions = [
      { reference: 'ref1', zaaktypeIdentificatie: 'Z1', bsn: '11111' },
      { reference: 'ref2', zaaktypeIdentificatie: 'Z2', kvk: '22222' },
    ] as ZGWRegistrationSubmission[];

    await Promise.all(submissions.map(s => creator.setInitiatorRol(s, 'http://zaak/1')));

    expect(mockCatalogiTypes.getRolTypeByOmschrijvingGeneriek).toHaveBeenCalledTimes(2);
    expect(mockRolApi.rolList).toHaveBeenCalledTimes(2);
    expect(mockRolApi.rolCreate).toHaveBeenCalledTimes(2);
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Submission ref1 has a BSN'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Submission ref2 has a KVK'));
  });

  it('should info-log when no BSN or KVK present', async () => {
    const submission = { reference: 'refX', zaaktypeIdentificatie: 'ZX' } as any;
    await creator.setInitiatorRol(submission, 'http://zaak/X');
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('No rol set'));
    expect(mockCatalogiTypes.getRolTypeByOmschrijvingGeneriek).not.toHaveBeenCalled();
  });

  describe('setRol', () => {
    it('should throw when rolType not found', async () => {
      (mockCatalogiTypes.getRolTypeByOmschrijvingGeneriek as jest.Mock).mockResolvedValue(undefined);
      const submission = { reference: 'ref0', zaaktypeIdentificatie: 'Z0' } as any;

      await expect(creator.setRol(submission, 'http://zaak/0', 'initiator')).rejects.toThrow(
        /RolType could not be retrieved/,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('RolType could not be retrieved'));
    });

    it('should not create rol if one already exists', async () => {
      const mockRolType = { url: 'rol-url' } as catalogi.RolType;
      (mockCatalogiTypes.getRolTypeByOmschrijvingGeneriek as jest.Mock).mockResolvedValue(mockRolType);

      const mockRolApi = {
        rolList: jest.fn().mockResolvedValue({ data: { count: 1, results: [{ id: 'existing-rol' }] } }),
        rolCreate: jest.fn(),
      };
      (zaken.Rollen as jest.Mock).mockImplementation(() => mockRolApi);

      const submission = {
        reference: 'refExist',
        zaaktypeIdentificatie: 'ZEX',
        bsn: '000111222',
      } as any;

      await creator.setInitiatorRol(submission, 'http://zaak/exists');

      expect(mockRolApi.rolList).toHaveBeenCalledWith({
        zaak: 'http://zaak/exists',
        roltype: 'rol-url',
      });
      expect(mockRolApi.rolCreate).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Rol was already set. Do not set again ',
        expect.anything(),
      );
    });

    it('should retry with kvkNummer if first rolCreate fails when using KVK', async () => {
      const mockRolType = { url: 'rol-url' } as catalogi.RolType;
      (mockCatalogiTypes.getRolTypeByOmschrijvingGeneriek as jest.Mock).mockResolvedValue(mockRolType);

      const failOnce = jest.fn()
        .mockRejectedValueOnce(new Error('validation'))
        .mockResolvedValueOnce({ data: { okay: true } });

      const mockRolApi = {
        rolList: jest.fn().mockResolvedValue({ data: { count: 0 } }),
        rolCreate: failOnce,
      };
      (zaken.Rollen as jest.Mock).mockImplementation(() => mockRolApi);

      const submission = {
        reference: 'refKVK',
        zaaktypeIdentificatie: 'ZKVK',
        kvk: '12345678',
      } as any;

      await creator.setInitiatorRol(submission, 'http://zaak/retry');

      expect(failOnce).toHaveBeenCalledTimes(2);
      const call1 = failOnce.mock.calls[0][0];
      const call2 = failOnce.mock.calls[1][0];
      expect(call1.betrokkeneIdentificatie.innNnpId).toBe('12345678');
      expect(call2.betrokkeneIdentificatie.kvkNummer).toBe('12345678');
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Use experimental kvkNummer'));
    });

    it('should propagate if second rolCreate also fails', async () => {
      const mockRolType = { url: 'rol-url' } as catalogi.RolType;
      (mockCatalogiTypes.getRolTypeByOmschrijvingGeneriek as jest.Mock)
        .mockResolvedValue(mockRolType);

      const alwaysFail = jest.fn().mockRejectedValue(new Error('still bad'));

      const mockRolApi = {
        rolList: jest.fn().mockResolvedValue({ data: { count: 0 } }),
        rolCreate: alwaysFail,
      };
      (zaken.Rollen as jest.Mock).mockImplementation(() => mockRolApi);

      const submission = {
        reference: 'refKVK2',
        zaaktypeIdentificatie: 'ZKVK2',
        kvk: '87654321',
      } as any;

      await expect(creator.setInitiatorRol(submission, 'http://zaak/retry2'))
        .rejects.toThrow();

      expect(alwaysFail).toHaveBeenCalledTimes(2);
    });
  });
});
