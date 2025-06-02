import { documenten } from '@gemeentenijmegen/modules-zgw-client';
import { FileDownloader } from '../FileDownloader';

jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation(() => ({
    done: jest.fn().mockResolvedValue(null),
  })),
}));


describe('SubmissionForwarderHandler', () => {
  let fakeDocumentenClientInstance: any;

  beforeEach(() => {

    fakeDocumentenClientInstance = {
      enkelvoudiginformatieobjectDownload: jest.fn().mockResolvedValue({ data: 'binary-pdf-data' }),
      enkelvoudiginformatieobjectRetrieve: jest.fn().mockResolvedValue({ data: { bestandsnaam: 'attachment.pdf', formaat: 'application/pdf' } }),
    };

    // Zorg dat wanneer de code de constructor van de documenten client aanroept,
    // een instance met de fake methoden teruggegeven wordt.
    jest.spyOn(documenten, 'Enkelvoudiginformatieobjecten').mockImplementation(() => fakeDocumentenClientInstance);

  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should be able to get a uuid from a file url', async () => {
    const downloader = new FileDownloader(fakeDocumentenClientInstance);
    expect(downloader.getUuidFromUrl('https://example.com/ec5d587c-ee8f-43c6-8be0-7dbc826b07f1')).toBe('ec5d587c-ee8f-43c6-8be0-7dbc826b07f1');
  });

  test('should be able to retrieve a document metadata', async () => {
    const downloader = new FileDownloader(fakeDocumentenClientInstance);
    const result = await downloader.fileDataFromDocument('https://example.com/ec5d587c-ee8f-43c6-8be0-7dbc826b07f1');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('filename');
    expect(result.format).toBe('application/pdf');
  });

  test('should be able to store a document under a subpath', async () => {
    const downloader = new FileDownloader(fakeDocumentenClientInstance);
    const resultWithPath = await downloader.fileDataFromDocument('https://example.com/ec5d587c-ee8f-43c6-8be0-7dbc826b07f1', 'somepath');
    const result = await downloader.fileDataFromDocument('https://example.com/ec5d587c-ee8f-43c6-8be0-7dbc826b07f1');
    expect(result).toHaveProperty('data');
    expect(resultWithPath.filename).toContain('somepath/');
    expect(result.filename).not.toContain('somepath/');
    expect(result.format).toBe('application/pdf');
  });

});
