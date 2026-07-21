/**
 * Terminal, non-retryable mapping failure: an incoming value has no known
 * Tribe target. Never caused by a temporary/network issue.
 */
export class MappingError extends Error { }

/**
 * OAuth2 client-credentials token request failed. Classified as `retryable`
 * so callers/Step Functions can distinguish a temporary auth hiccup (network,
 * timeout, Tribe 5xx on the token endpoint) from bad/missing credentials.
 * Never carries the client secret or the response body.
 */
export class TribeAuthenticationError extends Error {
  constructor(message: string, public readonly retryable: boolean) {
    super(message);
  }
}

/**
 * A Tribe API call (get/post) failed. Network errors, timeouts and 5xx are
 * retryable; 4xx and other validation failures are terminal. Never carries
 * the request/response body.
 */
export class TribeRequestError extends Error {
  constructor(message: string, public readonly retryable: boolean, public readonly status?: number) {
    super(message);
  }
}

/**
 * Terminal configuration failure: unknown tribeEnvironment, unknown
 * environment/submissiontype combination, or missing/unfilled credentials.
 * Never retried — there is no default environment and no silent fallback.
 */
export class ConfigurationError extends Error { }
