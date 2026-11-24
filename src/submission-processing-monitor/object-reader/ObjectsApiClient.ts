import { Logger } from '@aws-lambda-powertools/logger';

const PAGE_SIZE = 100;
const TIMEOUT_MS = 29_000;

export interface ObjectsApiClientOptions {
  baseUrl: string;
  token: string;
  logger?: Logger;
}

export class ObjectsApiError extends Error {}

export interface ObjectsApiPage {
  // The number of results over all pages, as the API reports it.
  count?: number;
  results: any[];
}

export class ObjectsApiClient {
  private readonly logger: Logger;
  private readonly baseUrl: string;

  constructor(private readonly options: ObjectsApiClientOptions) {
    this.logger = options.logger ? options.logger.createChild() : new Logger({ serviceName: 'ObjectsApiClient' });
    // Without a trailing slash, new URL('objects', baseUrl) would replace the last part of the base path.
    this.baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
  }

  /**
   * Reads all Objects page by page, the Object with the newest current record first and on uuid within a day. Stop early with break.
   * Only uuid, type and record.registrationAt come back. A failed page throws, so the caller never continues with a partial result.
   *
   * @returns Each page with its Objects and the count of the API.
   * @throws ObjectsApiError when a request fails, times out, returns an error status or returns no results array.
   * @example
   * const client = new ObjectsApiClient({ baseUrl, token });
   * for await (const page of client.objectPagesNewestFirst()) {
   *   console.log(page.count, page.results.length);
   * }
   */
  objectPagesNewestFirst(): AsyncGenerator<ObjectsApiPage> {
    this.logger.trace('Reading all Objects page by page, newest current record first');
    // registrationAt is only a date and the API pages with an offset: without uuid the order within a day differs per page.
    return this.readPages('objects', { ordering: '-record__registrationAt,uuid', fields: 'uuid,type,record__registrationAt' });
  }

  /**
   * Reads all records of one Object page by page. A failed page throws, so the caller never continues with a partial history.
   *
   * @param objectUuid The uuid of the Object.
   * @returns Each page with its records and the count of the API.
   * @throws ObjectsApiError when a request fails, times out, returns an error status or returns no results array.
   * @example
   * for await (const page of client.historyPages(objectUuid)) {
   *   console.log(page.results.length);
   * }
   */
  historyPages(objectUuid: string): AsyncGenerator<ObjectsApiPage> {
    this.logger.trace('Reading all records of one Object page by page', { objectUuid });
    return this.readPages(`objects/${objectUuid}/history`, {});
  }

  private async *readPages(path: string, query: Record<string, string>): AsyncGenerator<ObjectsApiPage> {
    const firstUrl = new URL(path, this.baseUrl);
    for (const [name, value] of Object.entries(query)) {
      firstUrl.searchParams.set(name, value);
    }
    firstUrl.searchParams.set('pageSize', String(PAGE_SIZE));

    let url: string | null = firstUrl.toString();
    while (url) {
      const page = await this.getPage(new URL(url));
      yield { count: page.count, results: page.results };
      url = page.next;
    }
  }

  private async getPage(url: URL): Promise<{ next: string | null; count?: number; results: any[] }> {
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
    return { next: body.next ?? null, count: body.count, results: body.results };
  }
}
