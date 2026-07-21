import { Logger } from '@aws-lambda-powertools/logger';
import { trace } from '../../shared/trace';
import { TribeVerzoek } from '../../shared/TribeVerzoek';
import { TribeClient } from '../client/TribeClient';
import { AUTODELEN_ENTITY } from '../constants/autodelen';
import { mapAutodelenAanmelding } from '../mappers/autodelen-aanmelding';
import { TribeProcessingContext, TribeProcessResult, TribeSubmissionProcessor } from '../support/TribeSubmissionProcessor.type';

const TRACE_HANDLER_ID = 'tribe_processor';

/**
 * Autodelen uses the shared processor contract for exactly one POST. Mapping
 * is pure and local, so a redrive can simply run it again.
 */
export function createAutodelenAanmeldingProcessor(logger: Logger = new Logger()): TribeSubmissionProcessor {
  return {
    async process(
      request: TribeVerzoek,
      client: TribeClient,
      context: TribeProcessingContext,
    ): Promise<TribeProcessResult> {
      const payload = mapAutodelenAanmelding(request, { reference: context.reference });

      logger.info('tribe_authentication_started');
      await client.authenticate();
      logger.info('tribe_authentication_succeeded');

      if (context.dryRun) {
        // Only visible at DEBUG level, so effectively accp-only given the log level per environment.
        logger.debug('tribe_dry_run_payload', { payload });
        logger.info('tribe_dry_run_completed');
        await trace(context.reference, TRACE_HANDLER_ID, 'DRY_RUN');
        return { status: 'dry-run' };
      }

      logger.info('tribe_request_started', { operation: 'create_autodelen_aanmelding' });
      await client.post(AUTODELEN_ENTITY.ENTITY_TYPE, payload);
      logger.info('tribe_request_succeeded', { operation: 'create_autodelen_aanmelding' });

      await trace(context.reference, TRACE_HANDLER_ID, 'OK');
      return { status: 'ok' };
    },
  };
}

export const autodelenAanmeldingProcessor = createAutodelenAanmeldingProcessor();
