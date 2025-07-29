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

// Mocks needed before handler (and others) is imported
import { ZgwClientFactory } from '../../shared/ZgwClientFactory';
import { handler } from '../zgw-registration.lambda';
import { ZGWHandler } from '../ZGWHandler';

describe('handler', () => {
  const mockSubmission = {
    reference: 'REF123',
    zaaktypeIdentificatie: 'ZT123',
    formName: 'fakeFormname',
    pdf: 'https://fakepdf',
    attachments: ['https://file'],
    bsn: '999998791',
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

    (ZGWHandler as jest.Mock).mockImplementation(() => ({
      handle: mockHandle,
    }));
  });

  it('should initialize clients and call ZGWHandler with submission', async () => {
    const result = await handler(mockSubmission);

    // Means the singleton mocks have been set/called
    expect(ZGWHandler).toHaveBeenCalledWith({
      zakenClient: mockZakenClient,
      catalogiClient: mockCatalogiClient,
    });
    expect(mockHandle).toHaveBeenCalledWith(mockSubmission);
    expect(result).toEqual(mockSubmission);
  });

  it('should initialize clients and call ZGWHandler with enrichedObject', async () => {
    const enrichedObjectMock = {
      enrichedObject: { ...mockSubmission },
      fileObjects: [{
        bucket: 'degeweldigebucket',
        objectKey: 'OF-UL5C4U/OF-UL5C4U.pdf',
        fileName: 'OF-UL5C4U.pdf',
      }],
      fielPaths: ['s3://fakefile'], // will become deprecated
    };
    const result = await handler(enrichedObjectMock);

    expect(ZGWHandler).toHaveBeenCalledWith({
      zakenClient: mockZakenClient,
      catalogiClient: mockCatalogiClient,
    });
    expect(mockHandle).toHaveBeenCalledWith(mockSubmission);
    expect(result).toEqual(mockSubmission);
  });

  it('should throw a zod error when event does not have the correct object', async () => {
    const badEventInput = {
      NOTenrichedObject: { ...mockSubmission },
      fileObjects: [{
        bucket: 'degeweldigebucket',
        objectKey: 'OF-UL5C4U/OF-UL5C4U.pdf',
        fileName: 'OF-UL5C4U.pdf',
      }],
      fielPaths: ['s3://fakefile'], // will become deprecated
    };

    await expect(handler(badEventInput)).rejects.toThrow(
      'ZGW Registration failed to parse input object. Does not comply with zod ZGWRegistrationSubmissionSchema.',
    );
  });

  it('should throw a formatted error when ZGWHandler fails', async () => {
    mockHandle.mockRejectedValueOnce(new Error('boom'));

    await expect(handler(mockSubmission)).rejects.toThrow(
      'Failed to ZGW register a form submision of type ZT123',
    );
  });
});
