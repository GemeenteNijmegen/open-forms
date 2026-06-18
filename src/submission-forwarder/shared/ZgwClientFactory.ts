import { HttpClient as CatalogiHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import { HttpClient as DocumentenHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/documenten-generated-client';
import { HttpClient as ZakenHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { AWS } from '@gemeentenijmegen/utils';
import * as jwt from 'jsonwebtoken';
import { ObjectsApiClient } from './ObjectsApiClient';

/**
 * Standard max token cache time before renewal
 */
const ZGW_TOKEN_CACHE_TTL_MS = 2 * 60 * 1000; // 1 minute in millisecond for testing purposes not too long
/**
 * CRS headers needed in some of the zgw clients
 */
const ZGW_CRS_HEADERS = { 'Content-Crs': 'EPSG:4326', 'Accept-Crs': 'EPSG:4326' } as const;
export interface ZgwClientFactoryCredentials {
  clientIdSsm: string;
  clientSecretArn: string;
  objectsApikeyArn: string;
}

/**
 * Can create JWT tokens
 * Has an async callback securityworker that uses the generated JWT token and renews it once it is invalid
 */
export class ZgwClientFactory {

  private clientId?: string;
  private clientSecret?: string;
  private objectsApikey?: string;
  private zgwTokenCache?: { token: string; issuedAt: number; refreshAt: number };

  constructor(private readonly credentials: ZgwClientFactoryCredentials) { }

  async getCatalogiClient(baseUrl: string) {
    const client = new CatalogiHttpClient({
      baseURL: baseUrl,
      format: 'json',
      securityWorker: () => this.createSecurityParameters(true),
    });
    return client;
  }

  async getDocumentenClient(baseUrl: string) {
    const client = new DocumentenHttpClient({
      baseURL: baseUrl,
      format: 'json',
      securityWorker: () => this.createSecurityParameters(false),
    });
    return client;
  }

  async getZakenClient(baseUrl: string) {
    const client = new ZakenHttpClient({
      baseURL: baseUrl,
      format: 'json',
      securityWorker: () => this.createSecurityParameters(true),
    });
    return client;
  }

  async getObjectsApiClient() {
    await this.loadCredentials();
    if (!this.objectsApikey) {
      throw Error('Initalization of the credentials failed');
    }
    return new ObjectsApiClient({ apikey: this.objectsApikey });
  }


  private async createSecurityParameters(includeCrsHeaders: boolean) {
    console.debug('createSecurityParameters callback function');
    const token = await this.getValidToken();
    return { headers: { Authorization: `Bearer ${token}`, ...(includeCrsHeaders ? ZGW_CRS_HEADERS : {}) } };
  }
  /**
 * Check if a token exists and the token is younger than the ttl
 * This check prevents the use of tokens with an IAT (issuance at) older than the set TTL
 * @returns a valid JWT token
 */
  private async getValidToken(): Promise<string> {
    const cachedToken = this.zgwTokenCache;
    const now = Date.now();
    if (cachedToken && now < cachedToken.refreshAt) {
      console.debug('ZGW JWT cache used.', { currentIat: cachedToken?.issuedAt, refreshAt: cachedToken?.refreshAt });
      return cachedToken.token;
    }
    const token = await this.createToken();
    const issuedAt = Math.floor(now / 1000); // epoch in seconds
    const refreshAt = now + ZGW_TOKEN_CACHE_TTL_MS; // epoch in milliseconds + TTL in milliseconds

    this.zgwTokenCache = { token, issuedAt, refreshAt };
    console.log('ZGW JWT cache refreshed.', { reason: cachedToken ? 'ttl-expired' : 'cache-empty', previousIat: cachedToken?.issuedAt, currentIat: issuedAt, refreshAt });
    return token;
  }
  /**
   * Generates a new JWT token for authentication.
   */
  private async createToken(): Promise<string> {
    await this.loadCredentials();
    if (!this.clientId || !this.clientSecret) {
      throw Error('Credentials for ZGW Client factory are not loaded correctly.');
    }
    return jwt.sign(
      {
        iss: this.clientId,
        iat: Math.floor(Date.now() / 1000), // epoch in seconds
        client_id: this.clientId,
        user_id: this.clientId,
        user_representation: this.clientId,
      },
      this.clientSecret,
      { expiresIn: '1h' }, // Set token expiration to 1 hour
    );
  }

  private async loadCredentials() {
    if (!this.clientId || !this.clientSecret || !this.objectsApikey) {
      try {
        this.clientId = await AWS.getParameter(this.credentials.clientIdSsm);
        this.clientSecret = await AWS.getSecret(this.credentials.clientSecretArn);
        this.objectsApikey = await AWS.getSecret(this.credentials.objectsApikeyArn);
      } catch (error) {
        console.error('Error retrieving credentials for zgwclient', error);
        throw error;
      }
    }
  }


}
