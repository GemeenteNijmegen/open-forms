import { TribeClient } from './TribeClient';
import { TribeAuthenticationError, TribeRequestError } from '../errors/ErrorTypes';

/** read: fetch objecttypes/records; write: create records; offline: refresh token support. Same for every Tribe environment. */
const DEFAULT_SCOPE = 'read write offline';

export interface TribeHttpClientOptions {
  environment: string;
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  /** Overridable for tests; defaults to {@link DEFAULT_SCOPE}. */
  scope?: string;
  /** Default 60s: Tribe calls can be slow, but this still leaves headroom under the Lambda's overall timeout. */
  requestTimeoutMs?: number;
  /** Injectable for tests; defaults to the global fetch. */
  fetchFn?: typeof fetch;
}

/**
 * One reusable HTTP implementation of {@link TribeClient}. No knowledge of a
 * specific submission type, no token cache between instances — each instance
 * should be created fresh per processing run by the client factory and reused
 * only within that run. Logs nothing itself and never returns the token,
 * client secret or Authorization header to the caller.
 */
export class TribeHttpClient implements TribeClient {
  public readonly environment: string;
  private readonly fetchFn: typeof fetch;
  private readonly requestTimeoutMs: number;
  private accessToken?: string;

  constructor(private readonly options: TribeHttpClientOptions) {
    this.environment = options.environment;
    this.fetchFn = options.fetchFn ?? fetch;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 60_000;
  }

  async authenticate(): Promise<void> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      scope: this.options.scope ?? DEFAULT_SCOPE,
    });

    let response: Response;
    try {
      response = await this.fetchWithTimeout(this.options.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      // Network/timeout errors never contain the client secret (that only lives in the request body).
      throw new TribeAuthenticationError(`Tribe authentication request failed for environment ${this.environment}: ${details}`, true);
    }

    if (!response.ok) {
      throw new TribeAuthenticationError(
        `Tribe authentication failed for environment ${this.environment} (status ${response.status})`,
        response.status >= 500,
      );
    }

    const { value: parsed, parseError } = await this.parseJsonSafely<{ access_token?: string }>(response);
    if (!parsed?.access_token) {
      const reason = parseError ? `: ${parseError}` : '';
      throw new TribeAuthenticationError(`Tribe authentication response for environment ${this.environment} had no access_token${reason}`, false);
    }
    this.accessToken = parsed.access_token;
  }

  async get<TResponse>(entitySet: string): Promise<TResponse> {
    return this.request<TResponse>('GET', entitySet);
  }

  async post<TRequest, TResponse>(entitySet: string, payload: TRequest): Promise<TResponse> {
    return this.request<TResponse>('POST', entitySet, payload);
  }

  private async request<TResponse>(method: 'GET' | 'POST', entitySet: string, payload?: unknown): Promise<TResponse> {
    if (!this.accessToken) {
      throw new TribeAuthenticationError(`No Tribe access token available for environment ${this.environment}; call authenticate() first`, false);
    }

    let response: Response;
    try {
      response = await this.fetchWithTimeout(`${this.options.baseUrl}${entitySet}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: payload !== undefined ? JSON.stringify(payload) : undefined,
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'AbortError';
      throw new TribeRequestError(
        `Tribe ${method} request to "${entitySet}" failed for environment ${this.environment}${timedOut ? ' (timeout)' : ''}`,
        true,
      );
    }

    if (!response.ok) {
      throw new TribeRequestError(
        `Tribe ${method} request to "${entitySet}" returned status ${response.status} for environment ${this.environment}`,
        response.status >= 500,
        response.status,
      );
    }

    const { value: parsed, parseError } = await this.parseJsonSafely<TResponse>(response);
    if (parsed === undefined) {
      const reason = parseError ? `: ${parseError}` : '';
      throw new TribeRequestError(
        `Tribe ${method} response for "${entitySet}" could not be parsed as JSON (environment ${this.environment})${reason}`,
        false,
      );
    }
    return parsed;
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      return await this.fetchFn(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseJsonSafely<T>(response: Response): Promise<{ value?: T; parseError?: string }> {
    try {
      return { value: await response.json() as T };
    } catch (error) {
      return { parseError: error instanceof Error ? error.message : String(error) };
    }
  }
}
