import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { mockClient } from 'aws-sdk-client-mock';
import * as traceModule from '../../shared/trace';
import { handler } from '../internalNotificationMail.lambda';


jest.mock('@aws-lambda-powertools/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    appendKeys: jest.fn(),
  })),
}));

// Set required env var
process.env.MAIL_FROM_DOMAIN = 'example.com';

// Create the SES mock client
const sesMock = mockClient(SESClient);

const baseSubmission = {
  formName: 'TestForm',
  reference: 'REF123',
  pdf: 'urlpdf',
  attachments: [],
  internalNotificationEmails: ['user@example.com'],
};

describe('handler', () => {
  beforeEach(() => {
    sesMock.reset();
    jest.clearAllMocks();
  });

  it('sends email and traces success', async () => {
    const validSubmissionWithNetworkShares = {
      ...baseSubmission,
      networkShare: '//server/path/to/folder',
      monitoringNetworkShare: '/monitor/path',
    };
    sesMock.on(SendEmailCommand).resolves({});
    const traceSpy = jest.spyOn(traceModule, 'trace').mockResolvedValue();

    const result = await handler(validSubmissionWithNetworkShares);
    expect(result).toEqual(validSubmissionWithNetworkShares);

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
    const bodyToCheck = sentCommands[0].args[0].input.Message?.Body?.Text?.Data;

    expect(bodyToCheck).toContain('TestForm');
    expect(bodyToCheck).toContain('U kunt de aanvraag op de volgende locaties terugvinden');
    expect(bodyToCheck).toContain('<\\\\server\\path\\to\\folder>'); // Double slashes because it escapes the slashes in the string
    expect(bodyToCheck).toContain('<\\monitor\\path>'); // Double slashes because it escapes the slashes in the string
  });

  it('should send an email with an enrichedObject without networkShare', async () => {
    const enrichedObjectMock = {
      enrichedObject: { ...baseSubmission },
      fileObjects: [{
        bucket: 'degeweldigebucket',
        objectKey: 'OF-UL5C4U/OF-UL5C4U.pdf',
        fileName: 'OF-UL5C4U.pdf',
      }],
      fielPaths: ['s3://fakefile'], // will become deprecated
    };
    sesMock.on(SendEmailCommand).resolves({});
    const traceSpy = jest.spyOn(traceModule, 'trace').mockResolvedValue();

    const result = await handler(enrichedObjectMock);
    expect(result).toEqual(enrichedObjectMock);

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
    const bodyToCheck = sentCommands[0].args[0].input.Message?.Body?.Text?.Data;

    expect(bodyToCheck).toContain('TestForm');
    expect(bodyToCheck).not.toContain('U kunt de aanvraag op de volgende locaties terugvinden');
  });
  it('logs and traces failure when SES send fails', async () => {
    sesMock.on(SendEmailCommand).rejects(new Error('SES error'));
    const traceSpy = jest.spyOn(traceModule, 'trace').mockResolvedValue();

    await handler(baseSubmission);

    expect(traceSpy).toHaveBeenCalledWith(
      'REF123',
      'NOTIFICATION_MAIL',
      'FAILED',
    );

  });
  it('should throw an error caught with trace when internalNotificationMails is falsy', async () =>{
    // Should never happen in step function when choice step is used to check for internalNotificationMails
    const traceSpy = jest.spyOn(traceModule, 'trace').mockResolvedValue();
    const falsyMailSubmission = {
      ...baseSubmission,
      internalNotificationEmails: undefined,
    };
    await handler(falsyMailSubmission);

    expect(traceSpy).toHaveBeenCalledWith(
      'REF123',
      'NOTIFICATION_MAIL',
      'FAILED',
    );
  });
});
