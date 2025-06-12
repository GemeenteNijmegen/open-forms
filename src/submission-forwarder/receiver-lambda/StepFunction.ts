import { Logger } from '@aws-lambda-powertools/logger';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { EnrichedZgwObjectData } from '../shared/EnrichedZgwObjectData';

export class StepFunction {
  private client: SFNClient;
  private stepfunctionArn: string;
  private logger: Logger;
  constructor(stepFunctionArn: string, options?: { client?: SFNClient; logger: Logger }) {
    this.stepfunctionArn = stepFunctionArn;
    this.client = options?.client ?? new SFNClient();
    this.logger = options?.logger ?? new Logger();
  }

  async startExecution(input: EnrichedZgwObjectData) {
    const execution = await this.client.send(new StartExecutionCommand({
      stateMachineArn: this.stepfunctionArn,
      input: JSON.stringify(input),
      name: this.sanitizeExecutionId(`${input.reference}-${Date.now()}`),
    }));
    this.logger.info('Started orchestrator', { executionArn: execution.executionArn });
  }

  sanitizeExecutionId(input: string): string {
    // Step 1: Sanitize the input string to allow only [a-zA-Z0-9_-]
    const sanitized = input.replace(/[^a-zA-Z0-9_-]/g, '');
    return sanitized.substring(0, 80);
  }
}
