import { Logger } from '@aws-lambda-powertools/logger';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { Context } from 'aws-lambda';
import { z } from 'zod';
import { ProcessingCheck, ProcessingCheckEvent } from './ProcessingCheck';
import { RunReport, RunReportCounts } from './report/RunReport';
import { ReportDelivery, reportMailOptionsSchema } from './report-text/ReportDelivery';
import { ProcessingCheckResultsRepository } from './store/ProcessingCheckResultsRepository';

const logger = new Logger({ serviceName: 'ProcessingCheck' });
const env = environmentVariables(['TABLE_NAME', 'DIAGNOSTICS', 'ENVIRONMENT_NAME', 'REPORT_FROM_ADDRESS']);

const resultsRepository = new ProcessingCheckResultsRepository({ tableName: env.TABLE_NAME });
const processingCheck = new ProcessingCheck({ resultsRepository, diagnostics: env.DIAGNOSTICS === 'true', logger });
const reportDelivery = new ReportDelivery({ fromAddress: env.REPORT_FROM_ADDRESS, logger });

export type ProcessingCheckLambdaEvent = ProcessingCheckEvent & z.input<typeof reportMailOptionsSchema>;

/**
 * Started each morning by EventBridge Scheduler, or by hand from the Lambda console.
 *
 * Checks the period, reads the histories of the submissions that need attention, and logs and mails the reports. Every log line has the
 * runId, so a filter on the runId shows how far a run got. The answer holds only the counts; the details are in the table, the
 * reports in the log.
 */
export async function handler(event: ProcessingCheckLambdaEvent, context: Context): Promise<RunReportCounts> {
  const runId = context.awsRequestId;
  const startedAt = Date.now();
  logger.info('Check and reports started', { runId, event, remainingTimeInMillis: context.getRemainingTimeInMillis() });
  try {
    const mailOptions = reportMailOptionsSchema.parse(event);

    const report = await processingCheck.run({ event, runId, getRemainingTimeInMillis: () => context.getRemainingTimeInMillis() });

    logger.info('Reading histories for the reports', { runId, objects: report.notOkObjectUuids.length });
    const notOkSubmissionHistories = await resultsRepository.getSubmissionHistories(report.notOkObjectUuids);
    const missing = report.notOkObjectUuids.length - notOkSubmissionHistories.length;
    logger.info('Histories for the reports read', { runId, objects: notOkSubmissionHistories.length, missing });

    await reportDelivery.deliver({ report, notOkSubmissionHistories, environment: env.ENVIRONMENT_NAME }, mailOptions);

    logger.info('Check and reports finished', { runId, status: report.status, durationMs: Date.now() - startedAt });
    return countsOf(report);
  } catch (error) {
    // Without this the runtime logs the error without the runId, and a filter on the runId would not find it.
    logger.error('Check and reports failed', { runId, durationMs: Date.now() - startedAt, error });
    throw error;
  }
}

// The report without the list of objects.
function countsOf(report: RunReport): RunReportCounts {
  return {
    runId: report.runId,
    firstDay: report.firstDay,
    lastDay: report.lastDay,
    status: report.status,
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    days: report.days,
    totals: report.totals,
    cost: report.cost,
  };
}
