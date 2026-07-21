import { AWS } from '@gemeentenijmegen/utils';
import { TribeClient } from './TribeClient';
import { TribeHttpClient } from './TribeHttpClient';
import { ConfigurationError } from '../errors/ErrorTypes';

const PLACEHOLDER_VALUE = 'VUL_HANDMATIG_IN';

export interface TribeClientFactoryOptions {
  /** Same for every environment. */
  baseUrl: string;
  tokenUrl: string;
  /** tribeEnvironment -> Secrets Manager ARN holding JSON `{clientId, clientSecret}`. */
  environmentSecretArns: Record<string, string>;
}

export interface TribeClientResult {
  client: TribeClient;
  /** Safe to log, e.g. `****A7F2`. Never the full client ID. */
  clientIdSuffix: string;
}

/**
 * Safely ties a `tribeEnvironment` to its credentials and returns a fresh,
 * isolated {@link TribeClient}. No default environment, no state shared
 * between environments: every `create()` call fetches the secret again and
 * builds a new instance.
 */
export class TribeClientFactory {
  constructor(private readonly options: TribeClientFactoryOptions) { }

  async create(environment: string): Promise<TribeClientResult> {
    const secretArn = this.options.environmentSecretArns[environment];
    if (!secretArn) {
      throw new ConfigurationError(`Unknown Tribe environment "${environment}": no secret configured`);
    }

    const { clientId, clientSecret } = await this.loadCredentials(environment, secretArn);

    const client = new TribeHttpClient({
      environment,
      baseUrl: this.options.baseUrl,
      tokenUrl: this.options.tokenUrl,
      clientId,
      clientSecret,
    });

    if (client.environment !== environment) {
      // Defensive: can't happen with the current implementation, but a mismatch
      // should never pass silently if that ever changes.
      throw new ConfigurationError(`Tribe client environment "${client.environment}" does not match requested environment "${environment}"`);
    }

    return { client, clientIdSuffix: `****${clientId.slice(-4)}` };
  }

  private async loadCredentials(environment: string, secretArn: string): Promise<{ clientId: string; clientSecret: string }> {
    const secretString = await AWS.getSecret(secretArn);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(secretString);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      // JSON.parse's error message never contains the secret value, only syntax info.
      throw new ConfigurationError(`Tribe credentials secret for environment "${environment}" is not valid JSON: ${details}`);
    }

    const clientId = parsed.clientId;
    const clientSecret = parsed.clientSecret;
    if (
      typeof clientId !== 'string' || typeof clientSecret !== 'string'
      || !clientId || !clientSecret
      || clientId === PLACEHOLDER_VALUE || clientSecret === PLACEHOLDER_VALUE
    ) {
      throw new ConfigurationError(`Tribe credentials for environment "${environment}" are missing or still contain the placeholder value`);
    }

    return { clientId, clientSecret };
  }
}
