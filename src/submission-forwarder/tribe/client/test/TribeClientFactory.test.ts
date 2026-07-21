import { AWS } from '@gemeentenijmegen/utils';
import { ConfigurationError } from '../../errors/ErrorTypes';
import { TribeClientFactory } from '../TribeClientFactory';

jest.mock('@gemeentenijmegen/utils', () => ({
  AWS: {
    getSecret: jest.fn(),
  },
}));

const getSecretMock = AWS.getSecret as jest.Mock;

function factory() {
  return new TribeClientFactory({
    baseUrl: 'https://tribe.example.com/v1/odata/',
    tokenUrl: 'https://tribe.example.com/oauth2/token',
    environmentSecretArns: {
      AUTODELEN: 'arn:aws:secretsmanager:eu-central-1:111111111111:secret:autodelen',
      ENERGIELOKET: 'arn:aws:secretsmanager:eu-central-1:111111111111:secret:energieloket',
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TribeClientFactory', () => {
  test('creates a client for a known environment using its own secret', async () => {
    getSecretMock.mockResolvedValue(JSON.stringify({ clientId: 'client-autodelen-12345', clientSecret: 'super-secret' }));
    const result = await factory().create('AUTODELEN');
    expect(result.client.environment).toBe('AUTODELEN');
    expect(getSecretMock).toHaveBeenCalledWith('arn:aws:secretsmanager:eu-central-1:111111111111:secret:autodelen');
  });

  test('each environment resolves its own secret ARN', async () => {
    getSecretMock.mockResolvedValue(JSON.stringify({ clientId: 'client-x', clientSecret: 'secret-x' }));
    await factory().create('ENERGIELOKET');
    expect(getSecretMock).toHaveBeenCalledWith('arn:aws:secretsmanager:eu-central-1:111111111111:secret:energieloket');
  });

  test('throws a ConfigurationError for an unknown environment (no default)', async () => {
    await expect(factory().create('ONBEKEND')).rejects.toBeInstanceOf(ConfigurationError);
    expect(getSecretMock).not.toHaveBeenCalled();
  });

  test('throws when the secret is not valid JSON', async () => {
    getSecretMock.mockResolvedValue('not-json');
    await expect(factory().create('AUTODELEN')).rejects.toBeInstanceOf(ConfigurationError);
  });

  test('throws when clientId or clientSecret is missing', async () => {
    getSecretMock.mockResolvedValue(JSON.stringify({ clientId: 'only-id' }));
    await expect(factory().create('AUTODELEN')).rejects.toBeInstanceOf(ConfigurationError);
  });

  test('throws when the secret still contains the unfilled placeholder', async () => {
    getSecretMock.mockResolvedValue(JSON.stringify({ clientId: 'VUL_HANDMATIG_IN', clientSecret: 'VUL_HANDMATIG_IN' }));
    await expect(factory().create('AUTODELEN')).rejects.toBeInstanceOf(ConfigurationError);
  });

  test('returns only a masked client-ID suffix, never the full client-ID', async () => {
    getSecretMock.mockResolvedValue(JSON.stringify({ clientId: 'abcdefgh-A7F2', clientSecret: 'super-secret' }));
    const result = await factory().create('AUTODELEN');
    expect(result.clientIdSuffix).toBe('****A7F2');
    expect(result.clientIdSuffix).not.toContain('abcdefgh');
  });

  test('two create() calls yield independent client instances (no shared state)', async () => {
    getSecretMock.mockResolvedValue(JSON.stringify({ clientId: 'client-autodelen-12345', clientSecret: 'super-secret' }));
    const first = await factory().create('AUTODELEN');
    const second = await factory().create('AUTODELEN');
    expect(first.client).not.toBe(second.client);
    expect(getSecretMock).toHaveBeenCalledTimes(2);
  });
});
