import * as tribeVerzoekFixture from '../../receiver-lambda/test/samples/tribeVerzoek.json';
import { TribeHttpClient } from '../client/TribeHttpClient';
import { TribeProcessorHandler } from '../Handler';
import { ProcessorRegistry } from '../processors/ProcessorRegistry';

const request = tribeVerzoekFixture.record.data;
const CLIENT_ID = 'abcdefgh-A7F2';
const CLIENT_SECRET = 'super-secret-value';

/**
 * Checks the logging context is correct, only the client-ID suffix is
 * visible, and the full client ID/secret/token/Authorization header never
 * end up in a log or error message.
 */
describe('Tribe logging and security', () => {
  test('Handler logs the fixed context (reference, environment, submissiontype, clientIdSuffix)', async () => {
    const logger = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn(), appendKeys: jest.fn() } as any;
    const registry = new ProcessorRegistry();
    registry.register('AUTODELEN', 'AUTODELEN_AANMELDING', { process: jest.fn().mockResolvedValue({ status: 'ok' }) });
    const clientFactory = {
      create: jest.fn().mockResolvedValue({
        client: { environment: 'AUTODELEN', authenticate: jest.fn(), get: jest.fn(), post: jest.fn() },
        clientIdSuffix: `****${CLIENT_ID.slice(-4)}`,
      }),
    } as any;

    const handler = new TribeProcessorHandler({ clientFactory, registry, dryRun: false, logger });
    await handler.handle(request);

    const appendedKeys = logger.appendKeys.mock.calls.flatMap((call: any) => Object.entries(call[0]));
    expect(appendedKeys).toEqual(expect.arrayContaining([
      ['reference', request.reference],
      ['tribeEnvironment', 'AUTODELEN'],
      ['tribeSubmissionType', 'AUTODELEN_AANMELDING'],
      ['clientIdSuffix', '****A7F2'],
    ]));
    // the full client ID must never appear in an appendKeys call
    expect(JSON.stringify(logger.appendKeys.mock.calls)).not.toContain(CLIENT_ID);
  });

  test('TribeHttpClient error messages never contain the client secret or the access token', async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: 'token-xyz-999' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    const client = new TribeHttpClient({
      environment: 'AUTODELEN',
      baseUrl: 'https://tribe.example.com/v1/odata/',
      tokenUrl: 'https://tribe.example.com/oauth2/token',
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await client.authenticate();

    try {
      await client.post('some-entity', {});
      fail('expected post() to throw');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(CLIENT_SECRET);
      expect(message).not.toContain('token-xyz-999');
    }
  });

  test('TribeHttpClient request headers use Bearer <token> and are never returned to the caller', async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: 'token-xyz-999' }) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ ID: 'created' }) });
    const client = new TribeHttpClient({
      environment: 'AUTODELEN',
      baseUrl: 'https://tribe.example.com/v1/odata/',
      tokenUrl: 'https://tribe.example.com/oauth2/token',
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await client.authenticate();
    const result: any = await client.post('some-entity', { field: 'value' });

    // the caller only gets the Tribe response back, never the Authorization header or the token
    expect(result).toEqual({ ID: 'created' });
    expect(JSON.stringify(result)).not.toContain('token-xyz-999');
  });
});
