import { Logger } from '@aws-lambda-powertools/logger';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { AWS } from '@gemeentenijmegen/utils';
import { mockClient } from 'aws-sdk-client-mock';
import { scenario as eenGewoneDag } from './samples/een-gewone-dag';
import { Statics } from '../../../../Statics';
import { ReportDelivery } from '../ReportDelivery';

const ses = mockClient(SESClient);
const fromAddress = 'submission-processing-monitor@example.nl';
const reportDelivery = new ReportDelivery({ fromAddress, logger: new Logger({ serviceName: 'test' }) });

beforeEach(() => {
  ses.reset();
  ses.on(SendEmailCommand).resolves({ MessageId: 'message-1' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('zonder mailopties komen beide rapporten in de log en wordt er niets gemaild of uit SSM gelezen', async () => {
  const getParameter = jest.spyOn(AWS, 'getParameter');
  // ReportDelivery logs with a child logger, so the spy is on the prototype.
  const info = jest.spyOn(Logger.prototype, 'info');

  const mailOptions = { emailSubmissionReport: false, emailEsfReport: false };
  await reportDelivery.deliver(eenGewoneDag.input, mailOptions);

  expect(getParameter).not.toHaveBeenCalled();
  expect(ses.commandCalls(SendEmailCommand)).toHaveLength(0);
  const reportTexts = info.mock.calls.filter(([message]) => message === 'Report text').map(([, fields]) => fields);
  expect(reportTexts).toMatchObject([
    { type: 'submissions', part: 1, parts: 1, ...eenGewoneDag.expected.submissionReport },
    { type: 'esf', part: 1, parts: 1, ...eenGewoneDag.expected.esfReport },
  ]);
});

test('als de ontvangers van het gewone rapport niet ingevuld zijn, gaat de ESF-mail toch en faalt het daarna', async () => {
  jest.spyOn(AWS, 'getParameter').mockImplementation(async (name) => {
    return name === Statics.ssmSubmissionProcessingMonitorEsfReportRecipients ? 'esf-beheer@example.nl, esf-beheer2@example.nl' : '-';
  });

  const mailOptions = { emailSubmissionReport: true, emailEsfReport: true };
  await expect(reportDelivery.deliver(eenGewoneDag.input, mailOptions)).rejects.toThrow('Report mail failed: submissions');

  const mails = ses.commandCalls(SendEmailCommand).map((call) => call.args[0].input);
  expect(mails).toMatchObject([{
    Source: fromAddress,
    Destination: { ToAddresses: ['esf-beheer@example.nl', 'esf-beheer2@example.nl'] },
    Message: { Subject: { Data: 'ESF - Dagrapport 22-11-2026 - Productie' }, Body: { Text: { Data: eenGewoneDag.expected.esfReport.body } } },
  }]);
});
