# open-forms: apply ZGW JWT staleness fix

Apply these changes once `@gemeentenijmegen/modules-zgw-client` ships the factory functions described in `package-spec.md`.

## Context

JWT tokens are currently created once per HTTP client construction. In warm Lambdas the client is cached across invocations, so the token's `iat` never advances. The receiving ZGW systems reject the JWT once the clock-skew tolerance is exceeded.

The fix: use the new package factory functions so `tokenFactory` is called on every outgoing HTTP request.

---

## 1. `src/submission-forwarder/shared/ZgwClientFactory.ts`

Replace the three `get*Client` methods. The `securityWorker` wiring and CRS headers move into the package; the factory just passes a token callback and calls `loadCredentials()` eagerly.

```typescript
import {
  createCatalogiClient,
  createDocumentenClient,
  createZakenClient,
} from '@gemeentenijmegen/modules-zgw-client';

// Remove these imports (now handled by the package):
// import { HttpClient as CatalogiHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
// import { HttpClient as DocumentenHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/documenten-generated-client';
// import { HttpClient as ZakenHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';

async getCatalogiClient(baseUrl: string) {
  await this.loadCredentials();
  return createCatalogiClient(baseUrl, () => this.createToken());
}

async getDocumentenClient(baseUrl: string) {
  await this.loadCredentials();
  return createDocumentenClient(baseUrl, () => this.createToken());
}

async getZakenClient(baseUrl: string) {
  await this.loadCredentials();
  return createZakenClient(baseUrl, () => this.createToken());
}
```

`loadCredentials()` and `createToken()` are unchanged. `createToken()` stays `private`.

---

## 2. `src/submission-forwarder/zgw-registration-lambda/zgw-registration.lambda.ts`

Remove the module-level HTTP client caches. They were the proximate cause of the staleness bug. With the factory fix they are now harmless, but they are misleading: a future reader infers that client caching is safe regardless of token lifetime.

**Remove** the two module-level variables and their imports:

```typescript
// Remove:
import { HttpClient as CatalogiHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import { HttpClient as ZakenHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';

let mijnServicesZakenClient: ZakenHttpClient | undefined = undefined;
let mijnServicesCatalogiClient: CatalogiHttpClient | undefined = undefined;
```

**Replace** the guarded cache-or-create blocks in `handler()` with direct calls:

```typescript
// Before:
if (!mijnServicesZakenClient) {
  mijnServicesZakenClient = await getMijnServicesZgwClientFactory().getZakenClient(env.ZAKEN_BASE_URL);
}
if (!mijnServicesCatalogiClient) {
  mijnServicesCatalogiClient = await getMijnServicesZgwClientFactory().getCatalogiClient(env.CATALOGI_BASE_URL);
}

// After:
const mijnServicesZakenClient = await getMijnServicesZgwClientFactory().getZakenClient(env.ZAKEN_BASE_URL);
const mijnServicesCatalogiClient = await getMijnServicesZgwClientFactory().getCatalogiClient(env.CATALOGI_BASE_URL);
```

The factory (`mijnServicesClientFactory`) stays cached — it holds the credential cache, not the token.

---

## 3. `src/submission-forwarder/documentsToS3Storage/documentsToS3Storage.lambda.ts`

Remove the module-level `documentenClient` cache for the same reason.

**Remove:**

```typescript
// Remove:
let documentenClient: Enkelvoudiginformatieobjecten | undefined = undefined;
```

**Replace** `getDocumentenClient`:

```typescript
// Before:
async function getDocumentenClient(zgwClientFactory: ZgwClientFactory, baseUrl: string) {
  if (!documentenClient) {
    const httpClient = await zgwClientFactory.getDocumentenClient(baseUrl);
    documentenClient = new Enkelvoudiginformatieobjecten(httpClient);
  }
  return documentenClient;
}

// After:
async function getDocumentenClient(zgwClientFactory: ZgwClientFactory, baseUrl: string) {
  const httpClient = await zgwClientFactory.getDocumentenClient(baseUrl);
  return new Enkelvoudiginformatieobjecten(httpClient);
}
```

---

## Files not requiring changes

- `receiver.lambda.ts` — no HTTP client cache, only a factory cache. No change needed.
- `forwarder.lambda.ts` — same.
- `getObjectsApiClient()` in `ZgwClientFactory` — uses an API key, not JWT. Unaffected.
