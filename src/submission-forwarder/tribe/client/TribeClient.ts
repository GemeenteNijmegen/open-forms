/**
 * One abstract Tribe client interface, shared by all Tribe environments. An
 * instance is permanently tied to a single `environment` and has no
 * knowledge of a specific submission type (e.g. Autodelen).
 */
export interface TribeClient {
  readonly environment: string;
  authenticate(): Promise<void>;
  get<TResponse>(entitySet: string): Promise<TResponse>;
  post<TRequest, TResponse>(entitySet: string, payload: TRequest): Promise<TResponse>;
}
