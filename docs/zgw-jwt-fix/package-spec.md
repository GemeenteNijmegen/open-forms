# ZGW client package: add per-request auth helpers

## Problem

The generated HTTP clients in this package (`CatalogiHttpClient`, `DocumentenHttpClient`, `ZakenHttpClient`) accept a `securityWorker` callback at construction time. Currently callers wire it with a static token: the token is generated once at construction and baked into `securityData`. In a long-lived process (e.g. a warm Lambda) this token grows stale, causing rejected JWTs once the receiving system's clock-skew tolerance is exceeded.

The fix is to call `securityWorker` with a `tokenFactory` callback so the token is generated fresh on every outgoing HTTP request.

## What to add

Add three factory functions — one per client type — that accept a `baseUrl` and a `tokenFactory` callback and return a fully configured client. The CRS headers (`Content-Crs`, `Accept-Crs`) are ZGW-domain knowledge and belong here, not in the caller.

### Suggested signatures

```typescript
type TokenFactory = () => Promise<string>;

export function createCatalogiClient(baseUrl: string, tokenFactory: TokenFactory): CatalogiHttpClient;
export function createDocumentenClient(baseUrl: string, tokenFactory: TokenFactory): DocumentenHttpClient;
export function createZakenClient(baseUrl: string, tokenFactory: TokenFactory): ZakenHttpClient;
```

### Reference implementation (repeat pattern for each client type)

```typescript
import { HttpClient as CatalogiHttpClient } from './catalogi-generated-client';

export function createCatalogiClient(baseUrl: string, tokenFactory: () => Promise<string>): CatalogiHttpClient {
  return new CatalogiHttpClient({
    baseURL: baseUrl,
    format: 'json',
    securityWorker: async () => {
      const token = await tokenFactory();
      return {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Crs': 'EPSG:4326',
          'Accept-Crs': 'EPSG:4326',
        },
      };
    },
  });
}

export function createDocumentenClient(baseUrl: string, tokenFactory: () => Promise<string>): DocumentenHttpClient {
  return new DocumentenHttpClient({
    baseURL: baseUrl,
    format: 'json',
    securityWorker: async () => {
      const token = await tokenFactory();
      return {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
    },
  });
}

export function createZakenClient(baseUrl: string, tokenFactory: () => Promise<string>): ZakenHttpClient {
  return new ZakenHttpClient({
    baseURL: baseUrl,
    format: 'json',
    securityWorker: async () => {
      const token = await tokenFactory();
      return {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Crs': 'EPSG:4326',
          'Accept-Crs': 'EPSG:4326',
        },
      };
    },
  });
}
```

### Export

Export all three from the package's main `index.ts`.

## What NOT to add

- Token caching / TTL management — that is the caller's responsibility if needed. `tokenFactory` is called on every request; keep it that way.
- Credential fetching (SSM, Secrets Manager) — credentials live in the calling application.
- Changes to the generated client code itself.

## Backward compatibility

The existing `HttpClient` constructors are unchanged. These are additive exports. No breaking changes.
