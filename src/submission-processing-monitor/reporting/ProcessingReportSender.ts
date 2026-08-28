import { Logger } from '@aws-lambda-powertools/logger';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { EsfProcessingReport, ProcessingReport } from '../model/ProcessingReport';

interface IncompleteOrFailedReportFields {
  periodFrom: string;
  periodTo: string;
  objectsScanComplete: boolean;
  executionsScanComplete: boolean;
  failureReason?: string;
}

/** Plain-text morning reports by e-mail, same SES pattern as internalNotificationMail.lambda.ts. Regular and ESF are sent as two separate mails. */
export class ProcessingReportSender {
  private readonly ses: SESClient;
  private readonly logger: Logger;

  constructor(private readonly fromAddress: string, ses: SESClient = new SESClient(), options: { logger?: Logger } = {}) {
    this.ses = ses;
    this.logger = options.logger ?? new Logger({ serviceName: 'ProcessingReportSender' });
  }

  async send(report: ProcessingReport, recipients: string[]): Promise<void> {
    if (recipients.length === 0) {
      this.logger.warn('No report recipients configured, report not sent', { status: report.status });
      return;
    }

    await this.ses.send(new SendEmailCommand({
      Message: {
        Subject: { Data: buildSubject(report) },
        Body: { Text: { Data: buildBody(report) } },
      },
      Destination: { ToAddresses: recipients },
      Source: this.fromAddress,
    }));

    this.logger.info('Processing report sent', { status: report.status, recipientCount: recipients.length, problemCount: report.problems.length });
  }

  async sendEsf(report: EsfProcessingReport, recipients: string[]): Promise<void> {
    if (recipients.length === 0) {
      this.logger.warn('No report recipients configured, ESF report not sent', { status: report.status });
      return;
    }

    await this.ses.send(new SendEmailCommand({
      Message: {
        Subject: { Data: buildEsfSubject(report) },
        Body: { Text: { Data: buildEsfBody(report) } },
      },
      Destination: { ToAddresses: recipients },
      Source: this.fromAddress,
    }));

    this.logger.info('ESF processing report sent', { status: report.status, recipientCount: recipients.length, problemCount: report.problems.length });
  }
}

function buildSubject(report: ProcessingReport): string {
  if (report.status === 'COMPLETED') {
    return `Submission processing monitor ${report.periodFrom}: ${report.problems.length} probleem/problemen`;
  }
  return `Submission processing monitor ${report.periodFrom}: ${report.status}`;
}

function buildBody(report: ProcessingReport): string {
  if (report.status !== 'COMPLETED') {
    return buildIncompleteOrFailedBody(report);
  }

  const lines = [
    `Periode: ${report.periodFrom} tot ${report.periodTo}`,
    '',
    `Regulier: ${report.regularCounters?.total} totaal, ${report.regularCounters?.succeeded} goed, ${report.regularCounters?.problem} probleem`,
    '',
  ];

  if (report.problems.length === 0) {
    lines.push('Geen problemen gevonden.');
  } else {
    lines.push('Problemen:');
    for (const problem of report.problems) {
      const reference = problem.reference ? `, reference ${problem.reference}` : '';
      // Not privacy sensitive, internal id
      const clientNumber = problem.clientNumber ? `, clientnummer ${problem.clientNumber}` : '';
      lines.push(`- ${problem.status}: uuid ${problem.objectUuid}, index ${problem.objectIndex}${reference}${clientNumber}`);
    }
  }

  return lines.join('\n');
}

function buildEsfSubject(report: EsfProcessingReport): string {
  if (report.status === 'COMPLETED') {
    return `Submission processing monitor ESF ${report.periodFrom}: ${report.problems.length} probleem/problemen`;
  }
  return `Submission processing monitor ESF ${report.periodFrom}: ${report.status}`;
}

function buildEsfBody(report: EsfProcessingReport): string {
  if (report.status !== 'COMPLETED') {
    return buildIncompleteOrFailedBody(report);
  }

  const lines = [
    `Periode: ${report.periodFrom} tot ${report.periodTo}`,
    '',
    `ESF: open ${report.esfCounters?.open}, afgerond ${report.esfCounters?.afgerond} `
      + `(goed ${report.esfCounters?.afgerondSucceeded}, probleem ${report.esfCounters?.afgerondProblem}), `
      + `verwerkt ${report.esfCounters?.verwerkt}, gesloten ${report.esfCounters?.gesloten}`,
    '',
  ];

  if (report.problems.length === 0) {
    lines.push('Geen problemen gevonden.');
  } else {
    lines.push('ESF-taken niet verwerkt door de step function:');
    for (const problem of report.problems) {
      const clientNumber = problem.clientNumber ? `, clientnummer ${problem.clientNumber}` : '';
      lines.push(`- ${problem.status}: ${problem.reference ?? '(geen referentie)'}${clientNumber}`);
    }
  }

  return lines.join('\n');
}

function buildIncompleteOrFailedBody(report: IncompleteOrFailedReportFields): string {
  return [
    `Periode: ${report.periodFrom} tot ${report.periodTo}`,
    `Objects scan compleet: ${report.objectsScanComplete ? 'ja' : 'nee'}`,
    `Execution scan compleet: ${report.executionsScanComplete ? 'ja' : 'nee'}`,
    report.failureReason ? `Reden: ${report.failureReason}` : undefined,
  ].filter((line): line is string => Boolean(line)).join('\n');
}
