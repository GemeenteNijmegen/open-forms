import { Logger } from '@aws-lambda-powertools/logger';

const PAGE_SIZE = 100;
const TIMEOUT_MS = 29_000;

export interface ObjectsApiClientOptions {
  baseUrl: string;
  token: string;
  logger?: Logger;
}

export class ObjectsApiError extends Error {}

export class ObjectsApiClient {
  private readonly logger: Logger;
  private readonly baseUrl: string;

  constructor(private readonly options: ObjectsApiClientOptions) {
    this.logger = options.logger ? options.logger.createChild() : new Logger({ serviceName: 'ObjectsApiClient' });
    // Without a trailing slash, new URL('objects', baseUrl) would replace the last part of the base path.
    this.baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
  }

  /**
   * Reads all Objects page by page, the Object with the newest current record first. Stop early with break.
   * A failed page throws, so the caller never continues with a partial result.
   *
   * @returns The Objects of each page.
   * @throws ObjectsApiError when a request fails, times out, returns an error status or returns no results array.
   * @example
   * const client = new ObjectsApiClient({ baseUrl, token });
   * for await (const objects of client.objectPagesNewestFirst()) {
   *   console.log(objects.length);
   * }
   */
  objectPagesNewestFirst(): AsyncGenerator<any[]> {
    this.logger.trace('Reading all Objects page by page, newest current record first');
    return this.readPages('objects', { ordering: '-record__registrationAt' });
  }

  /**
   * Reads all records of one Object page by page. A failed page throws, so the caller never continues with a partial history.
   *
   * @param objectUuid The uuid of the Object.
   * @returns The records of each page.
   * @throws ObjectsApiError when a request fails, times out, returns an error status or returns no results array.
   * @example
   * for await (const records of client.historyPages(objectUuid)) {
   *   console.log(records.length);
   * }
   */
  historyPages(objectUuid: string): AsyncGenerator<any[]> {
    this.logger.trace('Reading all records of one Object page by page', { objectUuid });
    return this.readPages(`objects/${objectUuid}/history`, {});
  }

  private async *readPages(path: string, query: Record<string, string>): AsyncGenerator<any[]> {
    const firstUrl = new URL(path, this.baseUrl);
    for (const [name, value] of Object.entries(query)) {
      firstUrl.searchParams.set(name, value);
    }
    firstUrl.searchParams.set('pageSize', String(PAGE_SIZE));

    let url: string | null = firstUrl.toString();
    while (url) {
      const page = await this.getPage(new URL(url));
      yield page.results;
      url = page.next;
    }
  }

  private async getPage(url: URL): Promise<{ next: string | null; results: any[] }> {
    const path = url.pathname;
    const query = Object.fromEntries(url.searchParams);
    const startedAt = Date.now();
    this.logger.trace('Objects API request', { path, query });

    // The timeout also covers reading the body, so the body is read inside the same try as fetch.
    let response: Response;
    let text: string;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Token ${this.options.token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      text = await response.text();
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      const reason = timedOut ? `timed out after ${TIMEOUT_MS} ms` : String(error);
      this.logger.error('Objects API request failed', { path, query, reason });
      throw new ObjectsApiError(`Objects API request to ${path} failed: ${reason}`);
    }

    const durationMs = Date.now() - startedAt;
    if (!response.ok) {
      this.logger.error('Objects API returned an error', { path, query, status: response.status, durationMs, body: text });
      throw new ObjectsApiError(`Objects API returned ${response.status} for ${path}`);
    }

    const body = JSON.parse(text);
    if (!Array.isArray(body.results)) {
      this.logger.error('Objects API returned no results array', { path, query, status: response.status, body: text });
      throw new ObjectsApiError(`Objects API returned no results array for ${path}`);
    }

    this.logger.debug('Objects API page read', { path, query, status: response.status, durationMs, count: body.count, resultCount: body.results.length });
    return { next: body.next ?? null, results: body.results };
  }
}
