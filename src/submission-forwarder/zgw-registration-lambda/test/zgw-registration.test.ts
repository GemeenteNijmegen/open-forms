
describe('SubmissionForwarderHandler', () => {
  // let fakeSubmission: any;
  // let fakeEvent: SNSEventRecord;
  // let fakeObjectsApiClient: any;
  // let fakeHttpClient: any;
  // let fakeDocumentenClientInstance: any;
  // let fakeZgwClientFactory: Partial<ZgwClientFactory>;

  beforeEach(() => {

    // fakeSubmission = {
    //   pdf: 'https://pdfurl/723647238',
    //   attachments: ['https://atturl/823948'],
    //   submissionValuesToFiles: [['file1', 'file content'], ['file1', 3], ['bsn', '']],
    //   reference: 'ref123',
    //   formName: 'formuliernaam',
    //   networkShare: '//karelstad/webdata/Webformulieren/TESTA',
    //   monitoringNetworkShare: '//karelstad/webdata/Webformulieren/TESTB',
    //   internalNotificationEmails: [
    //     'a@example.com',
    //     'b@example.com',
    //   ],
    // };

    // fakeEvent = {
    //   Sns: {
    //     Message: JSON.stringify({
    //       bsn: '',
    //       kvk: '',
    //       pdf: 'https://mijn-services.accp.nijmegen.nl/open-zaak/documenten/api/v1/enkelvoudiginformatieobjecten/657d12d8-4dd6-4b16-98b6-d8d08885c9ba',
    //       formName: 'Voorbeeld Netwerkschijf Registratie met Object',
    //       reference: 'OF-P5KAZF',
    //       attachments: [],
    //       networkShare: '//karelstad/webdata/Webformulieren/TESTA',
    //       monitoringNetworkShare: '//karelstad/webdata/Webformulieren/TESTB',
    //       submissionValuesToFiles: [],
    //       internalNotificationEmails: [
    //         'devops@nijmegen.nl',
    //       ],
    //     }),
    //   },
    // } as SNSEventRecord;

    // Fake HttpClient (inhoud niet belangrijk)
    // fakeHttpClient = {};

    // fakeDocumentenClientInstance = {
    //   enkelvoudiginformatieobjectDownload: jest.fn().mockResolvedValue({ data: 'binary-pdf-data' }),
    //   enkelvoudiginformatieobjectRetrieve: jest.fn().mockResolvedValue({ data: { bestandsnaam: 'attachment.pdf', formaat: 'application/pdf' } }),
    // };

    // Zorg dat wanneer de code de constructor van de documenten client aanroept,
    // een instance met de fake methoden teruggegeven wordt.
    // jest.spyOn(documenten, 'Enkelvoudiginformatieobjecten').mockImplementation(() => fakeDocumentenClientInstance);

    // fakeZgwClientFactory = {
    //   getObjectsApiClient: jest.fn().mockResolvedValue(fakeObjectsApiClient),
    //   getDocumentenClient: jest.fn().mockResolvedValue(fakeHttpClient),
    //   getZakenClient: jest.fn().mockResolvedValue(fakeHttpClient),
    //   getCatalogiClient: jest.fn().mockResolvedValue(fakeHttpClient),
    // };

    // Maak de handler met de fake dependencies
    // handler = new SubmissionForwarderHandler({
    //   zgwClientFactory: fakeZgwClientFactory as ZgwClientFactory,
    //   documentenBaseUrl: 'https://documenten.api',
    //   zakenBaseUrl: 'https://zaken.api',
    //   catalogiBaseUrl: 'https://catalogi.ap',
    // });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('TODO', async () => {
    console.log('No tests for ZGW Registration lambda yet...');
  });

});
