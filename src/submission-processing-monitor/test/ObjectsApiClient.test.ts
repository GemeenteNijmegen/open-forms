import { ObjectsApiClient, ObjectsApiError } from '../objects/ObjectsApiClient';

function mockResponse(ok: boolean, status: number, jsonBody: unknown): Response {
  return {
    ok,
    status,
    json: async () => jsonBody,
  } as unknown as Response;
}

function client(options: Partial<ConstructorParameters<typeof ObjectsApiClient>[0]> = {}) {
  return new ObjectsApiClient({
    baseUrl: 'https://domein.nl/objects/api/v2',
    apiKey: 'read-only-token-value',
    ...options,
  });
}

describe('ObjectsApiClient', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test('listObjectsPage requests newest-first ordering, page and pageSize', async () => {
    fetchSpy.mockResolvedValue(mockResponse(true, 200, { count: 0, next: null, results: [] }));
    await client().listObjectsPage({ page: 2, pageSize: 100 });

    const [requestedUrl] = fetchSpy.mock.calls[0];
    const url = new URL(requestedUrl.toString());
    expect(url.pathname).toBe('/objects/api/v2/objects');
    expect(url.searchParams.get('ordering')).toBe('-record__registrationAt');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('100');
  });

  test('listObjectHistory requests the history endpoint for the given object uuid', async () => {
    fetchSpy.mockResolvedValue(mockResponse(true, 200, { count: 0, next: null, results: [] }));
    await client().listObjectHistory('714eb3e8-2db1-4da2-bacd-c2c08187ceaf', { page: 1, pageSize: 100 });

    const [requestedUrl] = fetchSpy.mock.calls[0];
    const url = new URL(requestedUrl.toString());
    expect(url.pathname).toBe('/objects/api/v2/objects/714eb3e8-2db1-4da2-bacd-c2c08187ceaf/history');
  });

  test('never logs or leaks the api key into the request URL', async () => {
    fetchSpy.mockResolvedValue(mockResponse(true, 200, { count: 0, next: null, results: [] }));
    await client().listObjectsPage({ page: 1, pageSize: 100 });

    const [requestedUrl] = fetchSpy.mock.calls[0];
    expect(requestedUrl.toString()).not.toContain('read-only-token-value');
  });

  test('treats a non-2xx response as an explicit error instead of returning a partial result', async () => {
    fetchSpy.mockResolvedValue(mockResponse(false, 503, { detail: 'Service unavailable' }));
    await expect(client().listObjectsPage({ page: 1, pageSize: 100 })).rejects.toThrow(ObjectsApiError);
  });

  test('rejects a response that is missing count/results instead of returning it as-is', async () => {
    fetchSpy.mockResolvedValue(mockResponse(true, 200, { unexpected: 'shape' }));
    await expect(client().listObjectsPage({ page: 1, pageSize: 100 })).rejects.toThrow(ObjectsApiError);
  });

  test('aborts the request once the configured timeout passes', async () => {
    fetchSpy.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    await expect(client({ timeoutMs: 10 }).listObjectsPage({ page: 1, pageSize: 100 })).rejects.toThrow(ObjectsApiError);
  });

  test('rejects listObjectHistory for a uuid that is not shaped like a uuid, without ever building the request', async () => {
    await expect(client().listObjectHistory('not-a-uuid', { page: 1, pageSize: 100 })).rejects.toThrow(ObjectsApiError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('rejects a response body that is not valid JSON', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    } as unknown as Response);
    await expect(client().listObjectsPage({ page: 1, pageSize: 100 })).rejects.toThrow(ObjectsApiError);
  });
});
