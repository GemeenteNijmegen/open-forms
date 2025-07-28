const mockEnv = {
  DOCUMENTEN_BASE_URL: 'http://doc',
  ZAKEN_BASE_URL: 'http://zaken',
  CATALOGI_BASE_URL: 'http://catalogi',
  MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM: '/client/id',
  MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN: 'arn:secret',
  OBJECTS_API_APIKEY_ARN: 'arn:apikey',
};

jest.mock('@aws-lambda-powertools/logger');
jest.mock('@gemeentenijmegen/utils', () => ({
  environmentVariables: () => mockEnv,
}));
jest.mock('../../shared/ZgwClientFactory');
jest.mock('../ZGWHandler');
jest.mock('../ZGWRegistrationSubmission');

// Mocks needed before handler (and others) is imported
import { ZgwClientFactory } from '../../shared/ZgwClientFactory';
import { handler } from '../zgw-registration.lambda';
import { ZGWHandler } from '../ZGWHandler';
import { ZGWRegistrationSubmissionSchema } from '../ZGWRegistrationSubmission';

describe('handler', () => {
  const mockSubmission = {
    reference: 'REF123',
    zaaktypeIdentificatie: 'ZT123',
  };

  const mockZakenClient = {} as any;
  const mockCatalogiClient = {} as any;
  const mockGetZakenClient = jest.fn().mockResolvedValue(mockZakenClient);
  const mockGetCatalogiClient = jest.fn().mockResolvedValue(mockCatalogiClient);
  const mockHandle = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();

    (ZgwClientFactory as jest.Mock).mockImplementation(() => ({
      getZakenClient: mockGetZakenClient,
      getCatalogiClient: mockGetCatalogiClient,
    }));

    (ZGWRegistrationSubmissionSchema.parse as jest.Mock).mockReturnValue(mockSubmission);

    (ZGWHandler as jest.Mock).mockImplementation(() => ({
      handle: mockHandle,
    }));
  });

  it('should initialize clients and call ZGWHandler with submission', async () => {
    const result = await handler(mockSubmission);

    expect(ZgwClientFactory).toHaveBeenCalledWith({
      clientIdSsm: '/client/id',
      clientSecretArn: 'arn:secret',
      objectsApikeyArn: 'arn:apikey',
    });

    expect(mockGetZakenClient).toHaveBeenCalledWith('http://zaken');
    expect(mockGetCatalogiClient).toHaveBeenCalledWith('http://catalogi');
    expect(ZGWHandler).toHaveBeenCalledWith({
      zakenClient: mockZakenClient,
      catalogiClient: mockCatalogiClient,
    });
    expect(mockHandle).toHaveBeenCalledWith(mockSubmission);
    expect(result).toEqual(mockSubmission);
  });

  it('should throw a formatted error when ZGWHandler fails', async () => {
    mockHandle.mockRejectedValueOnce(new Error('boom'));

    await expect(handler(mockSubmission)).rejects.toThrow(
      'Failed to ZGW register a form submision of type ZT123',
    );
  });
});
