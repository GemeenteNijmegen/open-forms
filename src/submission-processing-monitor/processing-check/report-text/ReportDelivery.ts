import { Logger } from '@aws-lambda-powertools/logger';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { AWS } from '@gemeentenijmegen/utils';
import { z } from 'zod';
import { esfReportText } from './esfReportText';
import { ReportText, ReportTextInput } from './ReportText';
import { submissionReportText } from './submissionReportText';
import { Statics } from '../../../Statics';

const recipientsSchema = z.array(z.string().email()).min(1);

// Which reports to mail, from the event of the Lambda. Without them nothing is mailed, so a run from the console does not mail by accident.
export const reportMailOptionsSchema = z.object({
  emailSubmissionReport: z.boolean().default(false),
  emailEsfReport: z.boolean().default(false),
});

export type ReportMailOptions = z.infer<typeof reportMailOptionsSchema>;

export interface ReportDeliveryOptions {
  // The sender, like submission-processing-monitor@<domain of the account>.
  fromAddress: string;
  logger?: Logger;
}

interface ReportToDeliver {
  // In the log, to filter on one of the two reports.
  type: 'submissions' | 'esf';
  createText: (input: ReportTextInput) => ReportText;
  email: boolean;
  recipientsParameterName: string;
}

/**
 * Delivers the regular and the ESF report of a run: always to the log, and by mail when asked for.
 *
 * Both reports go to the log, with Report started before and Report finished after the text. A long text goes in parts.
 * The recipients are only read from SSM when that report is mailed. When a mail fails, the other report is still mailed, and then deliver
 * throws, so the Lambda fails and the alarm goes off. The results in DynamoDB are already stored by then.
 *
 * @example
 * const reportDelivery = new ReportDelivery({ fromAddress: 'submission-processing-monitor@example.nl', logger });
 * await reportDelivery.deliver(
 *   { report, notOkSubmissionHistories, environment: 'Productie' },
 *   { emailSubmissionReport: true, emailEsfReport: false },
 * );
 */
export class ReportDelivery {
  private readonly fromAddress: string;
  private readonly logger: Logger;
  private readonly ses: SESClient;

  constructor(options: ReportDeliveryOptions) {
    this.fromAddress = options.fromAddress;
    this.logger = options.logger ? options.logger.createChild() : new Logger({ serviceName: 'ReportDelivery' });
    this.ses = new SESClient();
  }

  /**
   * @param input The report of the run, the histories of its notOkObjectUuids and the environment.
   * @param mailOptions Which of the two reports to mail.
   * @returns When both reports are logged and the requested mails are sent. Throws after trying all mails when one failed.
   */
  async deliver(input: ReportTextInput, mailOptions: ReportMailOptions): Promise<void> {
    const logger = this.logger.createChild();
    logger.appendKeys({ runId: input.report.runId });
    logger.info('Reports started', {
      status: input.report.status,
      notOkSubmissionHistories: input.notOkSubmissionHistories.length,
      emailSubmissionReport: mailOptions.emailSubmissionReport,
      emailEsfReport: mailOptions.emailEsfReport,
    });

    const reports: ReportToDeliver[] = [
      {
        type: 'submissions',
        createText: submissionReportText,
        email: mailOptions.emailSubmissionReport,
        recipientsParameterName: Statics.ssmSubmissionProcessingMonitorSubmissionReportRecipients,
      },
      {
        type: 'esf',
        createText: esfReportText,
        email: mailOptions.emailEsfReport,
        recipientsParameterName: Statics.ssmSubmissionProcessingMonitorEsfReportRecipients,
      },
    ];

    const loggedReports = reports.map((report) => ({ report, text: this.logReport(report, input, logger) }));

    const failedTypes: string[] = [];
    for (const { report, text } of loggedReports) {
      const sent = await this.mailReport(report, text, logger);
      if (!sent) {
        failedTypes.push(report.type);
      }
    }

    logger.info('Reports finished', { failedMails: failedTypes });
    if (failedTypes.length > 0) {
      throw new Error(`Report mail failed: ${failedTypes.join(', ')}`);
    }
  }

  /**
   * Writes one report to the log, between Report started and Report finished.
   *
   * Report started comes first, so the log shows the report was begun when creating the text fails.
   * A long text goes in parts, each with its part number and the number of parts.
   */
  private logReport(report: ReportToDeliver, input: ReportTextInput, logger: Logger): ReportText {
    logger.info('Report started', { type: report.type });
    // CloudWatch Logs cuts off a log line at 256 KB, and the JSON log line makes the text larger (\n, é), so a long report goes in parts.
    const maxCharactersPerPart = 200_000;

    const text = report.createText(input);
    const parts = Math.max(1, Math.ceil(text.body.length / maxCharactersPerPart));
    logger.debug('Report text created', { type: report.type, subject: text.subject, characters: text.body.length, parts });
    for (let part = 1; part <= parts; part++) {
      const body = text.body.slice((part - 1) * maxCharactersPerPart, part * maxCharactersPerPart);
      logger.info('Report text', { type: report.type, part, parts, subject: text.subject, body });
    }

    logger.info('Report finished', { type: report.type, parts });
    return text;
  }

  /**
   * Mails one report when it is asked for, and logs what happened: not asked, sent with the MessageId of SES, or the error.
   *
   * Returns false when the mail failed. The log says at which step: reading the recipients from SSM, or sending with SES.
   */
  private async mailReport(report: ReportToDeliver, text: ReportText, logger: Logger): Promise<boolean> {
    if (!report.email) {
      logger.info('Report mail not requested', { type: report.type });
      return true;
    }

    let recipients: string[];
    try {
      recipients = await this.readRecipients(report.recipientsParameterName, logger);
    } catch (error) {
      logger.error('Report mail failed', { type: report.type, step: 'recipients', recipientsParameterName: report.recipientsParameterName, error });
      return false;
    }

    try {
      logger.debug('Report mail sending', { type: report.type, fromAddress: this.fromAddress, recipients: recipients.length });
      const result = await this.ses.send(new SendEmailCommand({
        Source: this.fromAddress,
        Destination: { ToAddresses: recipients },
        Message: {
          Subject: { Data: text.subject, Charset: 'UTF-8' },
          Body: { Text: { Data: text.body, Charset: 'UTF-8' } },
        },
      }));
      logger.info('Report mail sent', { type: report.type, messageId: result.MessageId, recipients: recipients.length });
      return true;
    } catch (error) {
      logger.error('Report mail failed', { type: report.type, step: 'ses', fromAddress: this.fromAddress, recipients: recipients.length, error });
      return false;
    }
  }

  /**
   * The recipients of a report from its SSM parameter.
   *
   * In: the name of a parameter with 'beheer1@example.nl, beheer2@example.nl'.
   * Out: ['beheer1@example.nl', 'beheer2@example.nl']. Throws when the parameter holds no valid address, like the '-' it is created with.
   * The addresses themselves are only logged on TRACE.
   */
  private async readRecipients(parameterName: string, logger: Logger): Promise<string[]> {
    logger.debug('Report recipients reading', { parameterName });
    const addresses = (await AWS.getParameter(parameterName)).split(',').map((address) => address.trim());
    logger.trace('Report recipients read', { parameterName, addresses });
    const recipients = recipientsSchema.parse(addresses);
    logger.debug('Report recipients valid', { parameterName, recipients: recipients.length });
    return recipients;
  }
}
