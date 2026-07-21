import { environmentVariables } from '@gemeentenijmegen/utils';
import { TribeClientFactory } from './client/TribeClientFactory';
import { TribeProcessorHandler } from './Handler';
import { autodelenAanmeldingProcessor } from './processors/autodelen-aanmelding';
import { ProcessorRegistry } from './processors/ProcessorRegistry';

const env = environmentVariables([
  'TRIBE_BASE_URL',
  'TRIBE_TOKEN_URL',
  'TRIBE_AUTODELEN_SECRET_ARN',
  'TRIBE_SEND_MODE',
]);

/**
 * Registers all known Tribe processors. No module-wide client factory or
 * client instance here — those are built fresh on every Lambda invocation so
 * credentials and tokens are never reused across Tribe environments.
 */
function buildRegistry(): ProcessorRegistry {
  const registry = new ProcessorRegistry();
  registry.register('AUTODELEN', 'AUTODELEN_AANMELDING', autodelenAanmeldingProcessor);
  return registry;
}

export async function handler(event: unknown) {
  const clientFactory = new TribeClientFactory({
    baseUrl: env.TRIBE_BASE_URL,
    tokenUrl: env.TRIBE_TOKEN_URL,
    environmentSecretArns: {
      AUTODELEN: env.TRIBE_AUTODELEN_SECRET_ARN,
    },
  });

  const tribeProcessorHandler = new TribeProcessorHandler({
    clientFactory,
    registry: buildRegistry(),
    dryRun: env.TRIBE_SEND_MODE === 'DRY_RUN',
  });

  return tribeProcessorHandler.handle(event);
}
