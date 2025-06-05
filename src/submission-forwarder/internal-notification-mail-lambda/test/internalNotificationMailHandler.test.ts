import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { mockClient } from 'aws-sdk-client-mock';
import * as traceModule from '../../shared/trace';
import { handler } from '../internalNotificationMail.lambda';

jest.mock('@aws-lambda-powertools/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    error: jest.fn(),
  })),
}));

// Set required env var
process.env.MAIL_FROM_DOMAIN = 'example.com';

// Create the SES mock client
const sesMock = mockClient(SESClient);

const validSubmission = {
  formName: 'TestForm',
  reference: 'REF123',
  pdf: 'urlpdf',
  attachments: [],
  networkShare: '//server/path/to/folder',
  monitoringNetworkShare: '/monitor/path',
  internalNotificationEmails: ['user@example.com'],
};

describe('handler', () => {
  beforeEach(() => {
    sesMock.reset();
    jest.clearAllMocks();
  });

  it('sends email and traces success', async () => {
    sesMock.on(SendEmailCommand).resolves({});
    const traceSpy = jest.spyOn(traceModule, 'trace').mockResolvedValue();

    await handler(validSubmission);

    expect(traceSpy).toHaveBeenCalledWith('REF123', 'NOTIFICATION_MAIL', 'OK');

    const sentCommands = sesMock.commandCalls(SendEmailCommand);
    expect(sentCommands.length).toBe(1);
    expect(sentCommands[0].args[0].input).toMatchObject({
      Destination: { ToAddresses: ['user@example.com'] },
      Message: {
        Subject: { Data: expect.stringContaining('TestForm') },
        Body: {
          Text: { Data: expect.stringContaining('kenmerk REF123') },
        },
      },
    });

  });

  it('logs and traces failure when SES send fails', async () => {
    sesMock.on(SendEmailCommand).rejects(new Error('SES error'));
    const traceSpy = jest.spyOn(traceModule, 'trace').mockResolvedValue();

    await handler(validSubmission);

    expect(traceSpy).toHaveBeenCalledWith(
      'REF123',
      'NOTIFICATION_MAIL',
      'FAILED',
    );

  });
});
