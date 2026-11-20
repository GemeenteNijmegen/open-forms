import { Logger } from '@aws-lambda-powertools/logger';
import { environmentVariables } from '@gemeentenijmegen/utils';
import { Context } from 'aws-lambda';
import { ProcessingCheck, ProcessingCheckEvent } from './ProcessingCheck';
import { RunReportCounts } from './report/RunReport';
import { ProcessingCheckResultsRepository } from './store/ProcessingCheckResultsRepository';

const logger = new Logger({ serviceName: 'ProcessingCheck' });
const env = environmentVariables(['TABLE_NAME', 'DIAGNOSTICS']);

const processingCheck = new ProcessingCheck({
  resultsRepository: new ProcessingCheckResultsRepository({ tableName: env.TABLE_NAME }),
  diagnostics: env.DIAGNOSTICS === 'true',
  logger,
});

// Started by hand from the Lambda console. The answer holds only the counts; the details are in the table.
export async function handler(event: ProcessingCheckEvent, context: Context): Promise<RunReportCounts> {
  const report = await processingCheck.run({
    event,
    runId: context.awsRequestId,
    getRemainingTimeInMillis: () => context.getRemainingTimeInMillis(),
  });
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
