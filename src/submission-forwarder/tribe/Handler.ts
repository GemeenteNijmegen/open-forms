import { Logger } from '@aws-lambda-powertools/logger';
import { TribeVerzoek, TribeVerzoekSchema } from '../shared/TribeVerzoek';
import { TribeClientFactory } from './client/TribeClientFactory';
import { ConfigurationError } from './errors/ErrorTypes';
import { ProcessorRegistry } from './processors/ProcessorRegistry';
import { TribeProcessResult } from './support/TribeSubmissionProcessor.type';

export interface TribeProcessorHandlerOptions {
  clientFactory: TribeClientFactory;
  registry: ProcessorRegistry;
  /** Exact `DRY_RUN`; any other value means send for real. */
  dryRun: boolean;
  logger?: Logger;
}

/**
 * Thin handler: builds logging context, selects the environment/submissiontype,
 * builds a client through the factory, and runs the selected processor.
 * Type-specific logic lives in the processor, not here.
 */
export class TribeProcessorHandler {
  private readonly logger: Logger;

  constructor(private readonly options: TribeProcessorHandlerOptions) {
    this.logger = options.logger ?? new Logger();
  }

  async handle(event: unknown): Promise<TribeProcessResult> {
    const request = TribeVerzoekSchema.parse(event) as TribeVerzoek;

    this.logger.appendKeys({
      reference: request.reference,
      tribeEnvironment: request.tribeEnvironment,
      tribeSubmissionType: request.tribeSubmissionType,
    });
    this.logger.info('tribe_processing_started');

    try {
      this.logger.info('tribe_environment_selected');
      const processor = this.options.registry.select(request.tribeEnvironment, request.tribeSubmissionType);
      this.logger.info('tribe_processor_selected');

      const { client, clientIdSuffix } = await this.options.clientFactory.create(request.tribeEnvironment);
      if (client.environment !== request.tribeEnvironment) {
        throw new ConfigurationError(
          `Tribe client environment "${client.environment}" does not match request environment "${request.tribeEnvironment}"`,
        );
      }
      this.logger.appendKeys({ clientIdSuffix });
      this.logger.info('tribe_credentials_loaded');
      this.logger.info('tribe_client_configured');

      const result = await processor.process(request, client, {
        reference: request.reference,
        tribeEnvironment: request.tribeEnvironment,
        tribeSubmissionType: request.tribeSubmissionType,
        dryRun: this.options.dryRun,
      });

      this.logger.info('tribe_processing_succeeded');
      return result;
    } catch (error) {
      this.logger.error('tribe_processing_failed', { error });
      throw error;
    }
  }
}
