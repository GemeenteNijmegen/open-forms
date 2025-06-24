import { Logger } from '@aws-lambda-powertools/logger';

/**
 * Publishes Mock Responses to the SNS Topic until the real trasnformation is implemented.
 * All handled in one class to make it easy to replace and delete
 */

export class MockVIPHandler {
  private readonly logger = new Logger({ serviceName: 'MockVIPHandler' });
  constructor() {
    this.logger.info('MockVIP logger should be replaced by a real implementation');
  }
  async handle(event: any) {
    this.logger.info('Mock handler gets event and returns a mock based on the input', event);
    // Just a couple of static responses

  }
}