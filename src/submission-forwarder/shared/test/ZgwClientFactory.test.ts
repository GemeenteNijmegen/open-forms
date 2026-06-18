import { AWS } from '@gemeentenijmegen/utils';
import * as jwt from 'jsonwebtoken';
import { ZgwClientFactoryCredentials, ZgwClientFactory, ZGW_TOKEN_CACHE_TTL_MS } from '../ZgwClientFactory';


jest.mock('@gemeentenijmegen/utils', () => ({
  AWS: {
    getParameter: jest.fn(),
    getSecret: jest.fn(),
  },
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
}));

const START_TIME = new Date('2026-06-18T10:00:00.000Z');

const credentials: ZgwClientFactoryCredentials = {
  clientIdSsm: '/zgw/client-id',
  clientSecretArn: 'arn:aws:secretsmanager:client-secret',
  objectsApikeyArn: 'arn:aws:secretsmanager:objects-api-key',
};


// Anders gaat hij moeilijk doen om de types bij het nadoen van de zgwclientfactory
type TestableZgwClientFactory = {
  getValidToken(): Promise<string>;
};

// Om de private functie aanroepen te kunnen doen
function getValidToken(factory: ZgwClientFactory): Promise<string> {
  return (
    factory as unknown as TestableZgwClientFactory
  ).getValidToken();
}

describe('ZgwClientFactory token cache', () => {
  const getParameterMock = AWS.getParameter as jest.Mock;
  const getSecretMock = AWS.getSecret as jest.Mock;
  const signMock = jwt.sign as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: START_TIME });

    getParameterMock.mockResolvedValue('client-id');

    getSecretMock
      .mockResolvedValueOnce('client-secret')
      .mockResolvedValueOnce('objects-api-key');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('maakt een JWT met de geladen credentials en de huidige tijd', async () => {
    signMock.mockReturnValue('token-1');

    const factory = new ZgwClientFactory(credentials);

    await expect(getValidToken(factory)).resolves.toBe('token-1');

    expect(signMock).toHaveBeenCalledTimes(1);
    expect(signMock).toHaveBeenCalledWith(
      {
        iss: 'client-id',
        iat: Math.floor(START_TIME.getTime() / 1000),
        client_id: 'client-id',
        user_id: 'client-id',
        user_representation: 'client-id',
      },
      'client-secret',
      {
        expiresIn: '1h',
      },
    );
  });

  it('hergebruikt het token binnen de TTL en vernieuwt het exact op de TTL', async () => {
    signMock
      .mockReturnValueOnce('token-1')
      .mockReturnValueOnce('token-2');

    const factory = new ZgwClientFactory(credentials);

    // Lege cache: token aanmaken.
    await expect(getValidToken(factory)).resolves.toBe('token-1');

    // Eén milliseconde vóór refreshAt: bestaand token gebruiken.
    jest.setSystemTime(
      new Date(START_TIME.getTime() + ZGW_TOKEN_CACHE_TTL_MS - 1),
    );

    await expect(getValidToken(factory)).resolves.toBe('token-1');
    expect(signMock).toHaveBeenCalledTimes(1);

    // Exact op refreshAt: token vernieuwen.
    jest.setSystemTime(
      new Date(START_TIME.getTime() + ZGW_TOKEN_CACHE_TTL_MS),
    );

    await expect(getValidToken(factory)).resolves.toBe('token-2');
    expect(signMock).toHaveBeenCalledTimes(2);

    // Credentials blijven na de eerste keer gecachet.
    expect(getParameterMock).toHaveBeenCalledTimes(1);
    expect(getSecretMock).toHaveBeenCalledTimes(2);
  });
});