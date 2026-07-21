import { ConfigurationError } from '../errors/ErrorTypes';
import { TribeSubmissionProcessor } from '../support/TribeSubmissionProcessor.type';

function processorKey(tribeEnvironment: string, tribeSubmissionType: string): string {
  return `${tribeEnvironment}::${tribeSubmissionType}`;
}

/**
 * Maps `tribeEnvironment` + `tribeSubmissionType` to exactly one processor.
 * No fallback: an unknown combination fails outright.
 */
export class ProcessorRegistry {
  private readonly processors = new Map<string, TribeSubmissionProcessor>();

  register(tribeEnvironment: string, tribeSubmissionType: string, processor: TribeSubmissionProcessor): void {
    this.processors.set(processorKey(tribeEnvironment, tribeSubmissionType), processor);
  }

  select(tribeEnvironment: string, tribeSubmissionType: string): TribeSubmissionProcessor {
    const key = processorKey(tribeEnvironment, tribeSubmissionType);
    const processor = this.processors.get(key);
    if (!processor) {
      throw new ConfigurationError(`Unknown Tribe environment/submissiontype combination "${key}"`);
    }
    return processor;
  }
}
