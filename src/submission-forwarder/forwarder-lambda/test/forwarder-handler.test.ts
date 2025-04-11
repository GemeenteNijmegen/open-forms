import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Upload } from '@aws-sdk/lib-storage';
import { documenten } from '@gemeentenijmegen/modules-zgw-client';
import { SQSRecord } from 'aws-lambda';
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
  let fakeEvent: SQSRecord;
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
      networkShare: 'nws://share',
      monitoringNetworkShare: 'nws://monitoring',
    };

    fakeEvent = {
      body: JSON.stringify({
        kanaal: 'kanaal',
        hoofdObject: 'hoofdObject',
        resource: 'object',
        resourceUrl: 'https://objects.api/object/123',
        actie: 'create',
        aanmaakdatum: '01-01-2025',
      }),
    } as SQSRecord;

    fakeObjectsApiClient = {
      getObject: jest.fn().mockResolvedValue({
        record: { data: fakeSubmission },
      }),
    };

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
    };

    // Maak de handler met de fake dependencies
    handler = new SubmissionForwarderHandler({
      zgwClientFactory: fakeZgwClientFactory as ZgwClientFactory,
      documentenBaseUrl: 'https://documenten.api',
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

    expect(fakeZgwClientFactory.getObjectsApiClient).toHaveBeenCalled();
    expect(fakeZgwClientFactory.getDocumentenClient).toHaveBeenCalledWith('https://documenten.api');

    // SQS send message moet twee keer aangeroepen worden, ook monitoring
    const sendMessageCalls = sqsMock.commandCalls(SendMessageCommand);
    expect(sendMessageCalls.length).toBe(2);

    // Haal de payloads op en controleer dat de targetNetworkLocation wordt overschreven voor de monitoring-notificatie
    const payloads = sendMessageCalls.map((call: any) => JSON.parse(call.args[0].input.MessageBody));
    const normalNotification = payloads.find((p: any) => p.targetNetworkLocation === fakeSubmission.networkShare);
    const monitoringNotification = payloads.find((p:any) => p.targetNetworkLocation === fakeSubmission.monitoringNetworkShare);
    expect(normalNotification).toBeDefined();
    expect(monitoringNotification).toBeDefined();
  });

  it('should send only one notification when monitoringNetworkShare is not provided', async () => {
    const emptyMonitoringSubmission = { ...fakeSubmission, monitoringNetworkShare: '' }; // copy with spreader

    fakeObjectsApiClient.getObject.mockResolvedValueOnce({
      record: { data: emptyMonitoringSubmission },
    });
    sqsMock.reset(); // reset de SQS-mock om de tellers weer op nul te zetten
    sqsMock.on(SendMessageCommand).resolves({});

    await handler.handle(fakeEvent);

    // Er mag maar 1 SQS-send call plaatsvinden, geen monitoringlocatie
    const sendMessageCalls = sqsMock.commandCalls(SendMessageCommand);
    expect(sendMessageCalls.length).toBe(1);
console.log('CommandCall', JSON.stringify(sendMessageCalls[0]));

    const payload = JSON.parse(sendMessageCalls[0].args[0].input.MessageBody!);
    expect(payload.targetNetworkLocation).toBe(emptyMonitoringSubmission.networkShare);
  });

  it('should not send any notification if networkShare is missing', async () => {
    const emptyNetworkShareSubmission = { ...fakeSubmission, networkShare: '' }; // copy with spreader
    fakeObjectsApiClient.getObject.mockResolvedValueOnce({
      record: { data: emptyNetworkShareSubmission },
    });
    await handler.handle(fakeEvent);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toBe(0);
  });
});
