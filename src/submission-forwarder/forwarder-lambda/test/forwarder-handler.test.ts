import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Upload } from '@aws-sdk/lib-storage';
import { documenten } from '@gemeentenijmegen/modules-zgw-client';
import { SNSEventRecord } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { SubmissionForwarderHandler } from '../Handler';
import { ZgwClientFactory } from '../ZgwClientFactory';


jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation(() => ({
    done: jest.fn().mockResolvedValue(null),
  })),
}));

const sqsMock = mockClient(SQSClient);

describe('SubmissionForwarderHandler', () => {
  let fakeSubmission: any;
  let fakeEvent: SNSEventRecord;
  let fakeObjectsApiClient: any;
  let fakeHttpClient: any;
  let fakeDocumentenClientInstance: any;
  let fakeZgwClientFactory: Partial<ZgwClientFactory>;
  const bucketName = 'test-bucket';
  const queueUrl = 'https://sqs.queue.url';

  let handler: SubmissionForwarderHandler;

  beforeEach(() => {
    sqsMock.reset();
    sqsMock.on(SendMessageCommand).resolves({});

    fakeSubmission = {
      pdf: 'https://pdfurl/723647238',
      attachments: ['https://atturl/823948'],
      submissionValuesToFiles: [['file1', 'file content'], ['file1', 3], ['bsn', '']],
      reference: 'ref123',
      formName: 'formuliernaam',
      networkShare: '//karelstad/webdata/Webformulieren/TESTA',
      monitoringNetworkShare: '//karelstad/webdata/Webformulieren/TESTB',
      internalNotificationEmails: [
        'a@example.com',
        'b@example.com',
      ],
    };

    fakeEvent = {
      Sns: {
        Message: JSON.stringify({
          bsn: '',
          kvk: '',
          pdf: 'https://mijn-services.accp.nijmegen.nl/open-zaak/documenten/api/v1/enkelvoudiginformatieobjecten/657d12d8-4dd6-4b16-98b6-d8d08885c9ba',
          formName: 'Voorbeeld Netwerkschijf Registratie met Object',
          reference: 'OF-P5KAZF',
          attachments: [],
          networkShare: '//karelstad/webdata/Webformulieren/TESTA',
          monitoringNetworkShare: '//karelstad/webdata/Webformulieren/TESTB',
          submissionValuesToFiles: [],
          internalNotificationEmails: [
            'devops@nijmegen.nl',
          ],
        }),
      },
    } as SNSEventRecord;

    // Fake HttpClient (inhoud niet belangrijk)
    fakeHttpClient = {};

    fakeDocumentenClientInstance = {
      enkelvoudiginformatieobjectDownload: jest.fn().mockResolvedValue({ data: 'binary-pdf-data' }),
      enkelvoudiginformatieobjectRetrieve: jest.fn().mockResolvedValue({ data: { bestandsnaam: 'attachment.pdf', formaat: 'application/pdf' } }),
    };

    // Zorg dat wanneer de code de constructor van de documenten client aanroept,
    // een instance met de fake methoden teruggegeven wordt.
    jest.spyOn(documenten, 'Enkelvoudiginformatieobjecten').mockImplementation(() => fakeDocumentenClientInstance);

    fakeZgwClientFactory = {
      getObjectsApiClient: jest.fn().mockResolvedValue(fakeObjectsApiClient),
      getDocumentenClient: jest.fn().mockResolvedValue(fakeHttpClient),
      getZakenClient: jest.fn().mockResolvedValue(fakeHttpClient),
      getCatalogiClient: jest.fn().mockResolvedValue(fakeHttpClient),
    };

    // Maak de handler met de fake dependencies
    handler = new SubmissionForwarderHandler({
      zgwClientFactory: fakeZgwClientFactory as ZgwClientFactory,
      documentenBaseUrl: 'https://documenten.api',
      zakenBaseUrl: 'https://zaken.api',
      catalogiBaseUrl: 'https://catalogi.ap',
      bucketName,
      queueUrl,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should send both a normal and monitoring notification when monitoringNetworkShare is provided', async () => {
    await handler.handle(fakeEvent);
    // Prevent unused import Upload
    const uploadInstances = (Upload as any as jest.Mock).mock.instances;
    expect(uploadInstances.length).toBeGreaterThan(0);

    expect(fakeZgwClientFactory.getDocumentenClient).toHaveBeenCalledWith('https://documenten.api');

    // SQS send message moet twee keer aangeroepen worden, ook monitoring
    const sendMessageCalls = sqsMock.commandCalls(SendMessageCommand);
    expect(sendMessageCalls.length).toBe(2);

    // Haal de payloads op en controleer dat de targetNetworkLocation wordt overschreven voor de monitoring-notificatie
    const payloads = sendMessageCalls.map((call: any) => JSON.parse(call.args[0].input.MessageBody));
    const normalNotification = payloads.find((p: any) => p.targetNetworkLocation === fakeSubmission.networkShare);
    console.log(payloads, fakeSubmission.networkShare);
    const monitoringNotification = payloads.find((p: any) => p.targetNetworkLocation === fakeSubmission.monitoringNetworkShare);
    expect(normalNotification).toBeDefined();
    expect(monitoringNotification).toBeDefined();
  });

  it('should send only one notification when monitoringNetworkShare is not provided', async () => {
    const emptyMonitoringSubmission = { ...fakeSubmission, monitoringNetworkShare: '' }; // copy with spreader

    sqsMock.reset(); // reset de SQS-mock om de tellers weer op nul te zetten
    sqsMock.on(SendMessageCommand).resolves({});

    const event = { Sns: { Message: JSON.stringify(emptyMonitoringSubmission) } };
    await handler.handle(event as any);

    // Er mag maar 1 SQS-send call plaatsvinden, geen monitoringlocatie
    const sendMessageCalls = sqsMock.commandCalls(SendMessageCommand);
    expect(sendMessageCalls.length).toBe(1);

    const payload = JSON.parse(sendMessageCalls[0].args[0].input.MessageBody!);
    expect(payload.targetNetworkLocation).toBe(emptyMonitoringSubmission.networkShare);
  });

  it('should not send any notification if networkShare is missing', async () => {
    const emptyNetworkShareSubmission = { ...fakeSubmission, networkShare: '' }; // copy with spreader
    const event = { Sns: { Message: JSON.stringify(emptyNetworkShareSubmission) } };
    await handler.handle(event as any);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toBe(0);
  });
});
