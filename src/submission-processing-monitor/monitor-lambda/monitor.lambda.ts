import { Logger } from '@aws-lambda-powertools/logger';
import { SESClient } from '@aws-sdk/client-ses';
import { AWS, environmentVariables } from '@gemeentenijmegen/utils';
import { Context } from 'aws-lambda';
import { MonitorHandler } from './MonitorHandler';
import { MonitorRunRepository } from '../dynamodb/MonitorRunRepository';
import { ProcessingIssueRepository } from '../dynamodb/ProcessingIssueRepository';
import { SubmissionExecutionReader } from '../executions/SubmissionExecutionReader';
import { ProcessingPeriodInput } from '../model/ProcessingPeriod';
import { ObjectProcessingRules, parseObjectTypesConfig } from '../objects/ObjectProcessingRules';
import { ObjectRecordReader } from '../objects/ObjectRecordReader';
import { ObjectsApiClient } from '../objects/ObjectsApiClient';
import { ProcessingReportSender } from '../reporting/ProcessingReportSender';

// Shared across the whole run so MonitorHandler's runId (via appendKeys) also shows up in every
// reader/sender log line, not just its own.
const logger = new Logger();

const env = environmentVariables([
  'OBJECTS_API_BASE_URL',
  'OBJECTS_API_TOKEN_ARN',
  'OBJECT_TYPES',
  'STATE_MACHINE_ARN',
  'MONITOR_RUNS_TABLE_NAME',
  'PROCESSING_ISSUES_TABLE_NAME',
  'REPORT_FROM_ADDRESS',
  'REPORT_ENABLED',
]);

/**
 * Recipients are read separately, not through environmentVariables(), because that throws when a
 * key is missing - a report-config problem should never bring down the whole monitor run. '-' is
 * the unfilled-in placeholder value for these SSM parameters, treated the same as absent/empty.
 */
function parseRecipients(value: string | undefined): string[] {
  if (!value || value === '-') {
    return [];
  }
  return value.split(',').map(email => email.trim()).filter(Boolean);
}

export async function handler(event: unknown, context: Context): Promise<void> {
  logger.debug('Received event', { event });

  const objectsApiToken = await AWS.getSecret(env.OBJECTS_API_TOKEN_ARN);
  const objectsClient = new ObjectsApiClient({ baseUrl: env.OBJECTS_API_BASE_URL, apiKey: objectsApiToken });
  const rules = new ObjectProcessingRules(parseObjectTypesConfig(env.OBJECT_TYPES));

  const monitorHandler = new MonitorHandler(
    new ObjectRecordReader(objectsClient, rules, { logger }),
    new SubmissionExecutionReader(env.STATE_MACHINE_ARN, { logger }),
    new MonitorRunRepository(env.MONITOR_RUNS_TABLE_NAME),
    new ProcessingIssueRepository(env.PROCESSING_ISSUES_TABLE_NAME),
    new ProcessingReportSender(env.REPORT_FROM_ADDRESS, new SESClient(), { logger }),
    parseRecipients(process.env.REPORT_RECIPIENTS),
    parseRecipients(process.env.ESF_REPORT_RECIPIENTS),
    env.REPORT_ENABLED === 'true',
    logger,
  );

  await monitorHandler.run(resolvePeriodInput(event), () => context.getRemainingTimeInMillis());
}

/** Defaults to a normal PREVIOUS_DAY run for manual test invocations without a Scheduler payload. */
function resolvePeriodInput(event: unknown): ProcessingPeriodInput {
  if (event && typeof event === 'object' && 'mode' in event) {
    return event as ProcessingPeriodInput;
  }
  return { mode: 'PREVIOUS_DAY' };
}
