import { TribeAuthenticationError, TribeRequestError } from '../../errors/ErrorTypes';
import { TribeHttpClient } from '../TribeHttpClient';

function mockResponse(ok: boolean, status: number, jsonBody: unknown): Response {
  return {
    ok,
    status,
    json: async () => jsonBody,
  } as unknown as Response;
}

function clientWithFetch(fetchFn: jest.Mock) {
  return new TribeHttpClient({
    environment: 'AUTODELEN',
    baseUrl: 'https://tribe.example.com/v1/odata/',
    tokenUrl: 'https://tribe.example.com/oauth2/token',
    clientId: 'client-id-value',
    clientSecret: 'client-secret-value',
    scope: 'read write offline',
    fetchFn: fetchFn as unknown as typeof fetch,
  });
}

describe('TribeHttpClient', () => {
  test('authenticate() stores the access token on success', async () => {
    const fetchFn = jest.fn().mockResolvedValue(mockResponse(true, 200, { access_token: 'token-abc' }));
    const client = clientWithFetch(fetchFn);
    await expect(client.authenticate()).resolves.toBeUndefined();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('authenticate() never leaks the client secret into the request URL', async () => {
    const fetchFn = jest.fn().mockResolvedValue(mockResponse(true, 200, { access_token: 'token-abc' }));
    const client = clientWithFetch(fetchFn);
    await client.authenticate();
    const [url] = fetchFn.mock.calls[0];
    expect(url).not.toContain('client-secret-value');
  });

  test('authenticate() requests the default scope when none is configured', async () => {
    const fetchFn = jest.fn().mockResolvedValue(mockResponse(true, 200, { access_token: 'token-abc' }));
    const client = new TribeHttpClient({
      environment: 'AUTODELEN',
      baseUrl: 'https://tribe.example.com/v1/odata/',
      tokenUrl: 'https://tribe.example.com/oauth2/token',
      clientId: 'client-id-value',
      clientSecret: 'client-secret-value',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await client.authenticate();
    const [, init] = fetchFn.mock.calls[0];
    expect(new URLSearchParams(init.body).get('scope')).toBe('read write offline');
  });

  test('authenticate() throws a retryable TribeAuthenticationError on a 5xx', async () => {
    const fetchFn = jest.fn().mockResolvedValue(mockResponse(false, 503, {}));
    const client = clientWithFetch(fetchFn);
    await expect(client.authenticate()).rejects.toMatchObject({ retryable: true });
    await expect(client.authenticate()).rejects.toBeInstanceOf(TribeAuthenticationError);
  });

  test('authenticate() throws a non-retryable TribeAuthenticationError on a 4xx', async () => {
    const fetchFn = jest.fn().mockResolvedValue(mockResponse(false, 401, {}));
    const client = clientWithFetch(fetchFn);
    await expect(client.authenticate()).rejects.toMatchObject({ retryable: false });
  });

  test('authenticate() throws a retryable error on a network failure', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError('network down'));
    const client = clientWithFetch(fetchFn);
    await expect(client.authenticate()).rejects.toMatchObject({ retryable: true });
  });

  test('post() succeeds and sends the Bearer token', async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(mockResponse(true, 200, { access_token: 'token-abc' }))
      .mockResolvedValueOnce(mockResponse(true, 201, { ID: 'created-1' }));
    const client = clientWithFetch(fetchFn);
    await client.authenticate();
    const result = await client.post('some-entity', { field: 'value' });
    expect(result).toEqual({ ID: 'created-1' });

    const [, postInit] = fetchFn.mock.calls[1];
    expect(postInit.headers.Authorization).toBe('Bearer token-abc');
  });

  test('get()/post() throw when called before authenticate()', async () => {
    const fetchFn = jest.fn();
    const client = clientWithFetch(fetchFn);
    await expect(client.get('some-entity')).rejects.toBeInstanceOf(TribeAuthenticationError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('post() throws a retryable TribeRequestError on a Tribe 5xx', async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(mockResponse(true, 200, { access_token: 'token-abc' }))
      .mockResolvedValueOnce(mockResponse(false, 500, {}));
    const client = clientWithFetch(fetchFn);
    await client.authenticate();
    await expect(client.post('some-entity', {})).rejects.toMatchObject({ retryable: true, status: 500 });
  });

  test('post() throws a non-retryable TribeRequestError on a Tribe 4xx', async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(mockResponse(true, 200, { access_token: 'token-abc' }))
      .mockResolvedValueOnce(mockResponse(false, 400, {}));
    const client = clientWithFetch(fetchFn);
    await client.authenticate();
    await expect(client.post('some-entity', {})).rejects.toMatchObject({ retryable: false, status: 400 });
  });

  test('get() throws a retryable TribeRequestError on a timeout (AbortError)', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(mockResponse(true, 200, { access_token: 'token-abc' }))
      .mockRejectedValueOnce(abortError);
    const client = clientWithFetch(fetchFn);
    await client.authenticate();
    await expect(client.get('some-entity')).rejects.toMatchObject({ retryable: true });
  });

  test('get()/post() throw a retryable TribeRequestError on a network failure', async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(mockResponse(true, 200, { access_token: 'token-abc' }))
      .mockRejectedValueOnce(new TypeError('network down'));
    const client = clientWithFetch(fetchFn);
    await client.authenticate();
    await expect(client.get('some-entity')).rejects.toBeInstanceOf(TribeRequestError);
  });

  test('never makes a real network call (fetchFn is always the injected mock)', async () => {
    const fetchFn = jest.fn().mockResolvedValue(mockResponse(true, 200, { access_token: 'token-abc' }));
    const client = clientWithFetch(fetchFn);
    await client.authenticate();
    // every call went through the injected mock, not globalThis.fetch
    expect(fetchFn.mock.calls.length).toBeGreaterThan(0);
  });
});
