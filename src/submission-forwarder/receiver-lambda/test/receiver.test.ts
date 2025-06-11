import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { mockClient } from 'aws-sdk-client-mock';
import { ReceiverHandler } from '../Handler';


describe('receiver', () => {

  // Mock AWS connections
  const stepfunctionMock = mockClient(SFNClient);
  const dynamodb = mockClient(DynamoDBClient);
  dynamodb.on(PutItemCommand).resolves({});

  const fakeSubmission = {
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

  const fakeEvent = {
    body: JSON.stringify({
      actie: 'create',
      kanaal: 'objecten',
      hoofdObject: 'https://example.com/objecturl',
      resourceUrl: 'https://example.com/objecturl',
      resource: 'object',
      aanmaakdatum: '2025-01-01',
    }),
  };

  let fakeHttpClient: any = {};
  let fakeObjectsApiClient: any = {
    getObject: jest.fn().mockResolvedValue({
      type: 'https://example.com/objecturl',
      url: 'https://example.com/objecturl',
      uuid: '02e286e7-934a-4301-a523-a7870116fd84',
      record: { data: fakeSubmission },
    }),
  };

  let fakeZgwClientFactory = {
    getObjectsApiClient: jest.fn().mockResolvedValue(fakeObjectsApiClient),
    getDocumentenClient: jest.fn().mockResolvedValue(fakeHttpClient),
    getZakenClient: jest.fn().mockResolvedValue(fakeHttpClient),
    getCatalogiClient: jest.fn().mockResolvedValue(fakeHttpClient),
  };

  test('Initalization', () => {

    new ReceiverHandler({
      zgwClientFactory: fakeZgwClientFactory as any,
      topicArn: 'arn:topci:aws:somewhere',
      orchestratorArn: 'arn:topci:aws:somewhere',
      supportedObjectTypes: 'submission##https://example.com/objecturl',
    });

  });

  test('Handle event', async () => {
    const handler = new ReceiverHandler({
      zgwClientFactory: fakeZgwClientFactory as any,
      topicArn: 'arn:topci:aws:somewhere',
      orchestratorArn: 'arn:topci:aws:somewhere',
      supportedObjectTypes: 'submission##https://example.com/objecturl',
    });
    await handler.handle(fakeEvent as any);

    // Should start execution
    const executed = stepfunctionMock.commandCalls(StartExecutionCommand);
    expect(executed.length).toBe(1);
  });


});
