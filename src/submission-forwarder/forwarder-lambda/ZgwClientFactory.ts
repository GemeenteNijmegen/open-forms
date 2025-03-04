import { HttpClient as CatalogiHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import { HttpClient as DocumentenHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/documenten-generated-client';
import { AWS } from '@gemeentenijmegen/utils';
import * as jwt from 'jsonwebtoken';
import { ObjectsApiClient } from './ObjectsApiClient';

export interface ZgwClientFactoryCredentials {
  clientIdSsm: string;
  clientSecretArn: string;
  objectsApikeyArn: string;
}

export class ZgwClientFactory {

  private clientId?: string;
  private clientSecret?: string;
  private objectsApikey?: string;

  constructor(private readonly credentials: ZgwClientFactoryCredentials) { }

  async getCatalogiClient(baseUrl: string) {
    const token = await this.createToken();
    const client = new CatalogiHttpClient({
      baseURL: baseUrl,
      format: 'json',
      async securityWorker(securityData: any) {
        return {
          headers: {
            Authorization: `Bearer ${securityData?.token}`,
          },
        };
      },
    });
    client.setSecurityData({ token });
    return client;
  }

  async getDocumentenClient(baseUrl: string) {
    const token = await this.createToken();
    const client = new DocumentenHttpClient({
      baseURL: baseUrl,
      format: 'json',
      async securityWorker(securityData: any) {
        return {
          headers: {
            Authorization: `Bearer ${securityData?.token}`,
          },
        };
      },
    });
    client.setSecurityData({ token });
    return client;
  }

  async getObjectsApiClient() {
    await this.loadCredentials();
    if (!this.objectsApikey) {
      throw Error('Initalization of the credentials failed');
    }
    return new ObjectsApiClient({ apikey: this.objectsApikey });
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
        iat: Math.floor(Date.now() / 1000),
        client_id: this.clientId,
        user_id: this.clientId,
        user_representation: this.clientId,
      },
      this.clientSecret,
      { expiresIn: '12h' }, // Set token expiration to 12 hours
    );
  }

  private async loadCredentials() {
    if (!this.clientId || !this.clientSecret || !this.objectsApikey) {
      this.clientId = await AWS.getParameter(this.credentials.clientIdSsm);
      this.clientSecret = await AWS.getSecret(this.credentials.clientSecretArn);
      this.objectsApikey = await AWS.getSecret(this.credentials.objectsApikeyArn);
    }
  }


}
