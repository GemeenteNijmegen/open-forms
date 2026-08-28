import { Logger } from '@aws-lambda-powertools/logger';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_TIMEOUT_MS = 29_000;

export interface ObjectsApiClientOptions {
  baseUrl: string;
  apiKey: string;
  /** @default 10000 */
  timeoutMs?: number;
  logger?: Logger;
}

export interface ObjectListRecord {
  index: number;
  typeVersion: number;
  data: Record<string, unknown>;
  startAt: string;
  endAt: string | null;
  registrationAt: string;
  correctionFor?: number;
  correctedBy?: number;
}

export interface ObjectListItem {
  url: string;
  uuid: string;
  type: string;
  record: ObjectListRecord;
}

export interface ObjectsPage<T> {
  count: number;
  next: string | null;
  results: T[];
}

export class ObjectsApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

/**
 * Read-only client for the parts of the Objects API this monitor needs. Does not implement
 * anything used to create, update or delete objects, this is a read model.
 */
export class ObjectsApiClient {
  private readonly logger: Logger;
  private readonly timeoutMs: number;

  constructor(private readonly options: ObjectsApiClientOptions) {
    this.logger = options.logger ?? new Logger({ serviceName: 'ObjectsApiClient' });
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * One page of objects, sorted by newest current registration first (-record__registrationAt),
   * so discovery can stop once a page's objects are provably older than the requested period.
   *
   * No server-side object type filter: the Objecttypes API is a separate service with its own base
   * URL we don't have configured, so matching on object type happens client-side against object.type
   * instead (same approach as the receiver's matchesObjectType in ObjectParser.ts).
   */
  async listObjectsPage(params: { page: number; pageSize: number }): Promise<ObjectsPage<ObjectListItem>> {
    const url = new URL('objects', this.baseUrlWithTrailingSlash());
    url.searchParams.set('ordering', '-record__registrationAt');
    url.searchParams.set('page', String(params.page));
    url.searchParams.set('pageSize', String(params.pageSize));
    return this.getPage<ObjectListItem>(url);
  }

  /**
   * One page of an object's full history (all records, not just the current one).
   */
  async listObjectHistory(uuid: string, params: { page: number; pageSize: number }): Promise<ObjectsPage<ObjectListRecord>> {
    if (!UUID_PATTERN.test(uuid)) {
      throw new ObjectsApiError(`Objects API history request requires a valid object uuid, got: ${uuid}`);
    }
    const url = new URL(`objects/${uuid}/history`, this.baseUrlWithTrailingSlash());
    url.searchParams.set('page', String(params.page));
    url.searchParams.set('pageSize', String(params.pageSize));
    return this.getPage<ObjectListRecord>(url);
  }

  private baseUrlWithTrailingSlash(): string {
    return this.options.baseUrl.endsWith('/') ? this.options.baseUrl : `${this.options.baseUrl}/`;
  }

  private async getPage<T>(url: URL): Promise<ObjectsPage<T>> {
    const response = await this.fetchWithTimeout(url);
    if (!response.ok) {
      throw new ObjectsApiError(`Objects API request failed with status ${response.status}`, response.status);
    }
    const body = await this.parseJson(url, response);
    if (typeof body.count !== 'number' || !Array.isArray(body.results)) {
      throw new ObjectsApiError(`Objects API response for ${url.toString()} is missing count/results`);
    }
    this.logger.info('Objects API response', { url: url.toString(), status: response.status, count: body.count, resultCount: body.results.length });
    return body as ObjectsPage<T>;
  }

  private async fetchWithTimeout(url: URL): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    this.logger.info('Objects API request', { url: url.toString() });
    try {
      return await fetch(url, {
        headers: { Authorization: `Token ${this.options.apiKey}`, Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ObjectsApiError(`Objects API request timed out after ${this.timeoutMs}ms`);
      }
      throw new ObjectsApiError(`Objects API request failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseJson(url: URL, response: Response): Promise<{ count?: unknown; results?: unknown }> {
    try {
      return await response.json() as { count?: unknown; results?: unknown };
    } catch {
      throw new ObjectsApiError(`Objects API response for ${url.toString()} is not valid JSON`);
    }
  }
}
