import { TribeVerzoek } from '../../shared/TribeVerzoek';
import { TribeClient } from '../client/TribeClient';

export interface TribeProcessingContext {
  reference: string;
  tribeEnvironment: string;
  tribeSubmissionType: string;
  /** Exact `DRY_RUN` on accp; never on production. */
  dryRun: boolean;
}

export interface TribeProcessResult {
  status: 'ok' | 'dry-run';
}

/**
 * Small async processor contract, not a generic workflow engine. An
 * implementation may make several sequential Tribe calls internally and use
 * the response from call N to build payload N+1; that stays inside
 * `process()` itself, not in this contract.
 */
export interface TribeSubmissionProcessor {
  process(
    request: TribeVerzoek,
    client: TribeClient,
    context: TribeProcessingContext,
  ): Promise<TribeProcessResult>;
}
