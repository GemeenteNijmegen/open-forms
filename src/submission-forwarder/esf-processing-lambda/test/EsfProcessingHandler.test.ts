import { S3Uploader } from '../../documentsToS3Storage/S3Uploader';
import { EsfProcessingHandler } from '../EsfProcessingHandler';

const reference = 'ESF-OF-123456-12345678-202510';

function input(enrichedObjectOverrides?: Record<string, unknown>) {
  return {
    enrichedObject: {
      pdf: 'https://example.com/documenten/api/v1/enkelvoudiginformatieobjecten/1',
      attachments: [],
      reference,
      objectUrl: 'https://example.com/objects/api/v2/objects/1',
      taak: {
        soort: 'formtaak',
        titel: 'Statusformulier invullen',
        status: 'afgerond',
        eigenaar: 'nijmegen',
        formtaak: {
          formulier: { soort: 'url', value: 'https://formulier.nijmegen.nl/statusformulier' },
          data: {
            clientnummer: '12345',
            termijnvanordedatum: '2025-07-05',
            inkhef: 'NEE',
            dossiernummer: '12345678',
            regelingnummer: '0',
            periodenummer: '202510',
            email: 'info@example.com',
            telefoon: '06123123123',
          },
          verzonden_data: {
            formulierreferentie: 'OF-123456',
            email: 'info@example.com',
            telefoon: '0632132131',
            inkomstengewijzigd: 'ja',
            woonsituatiegewijzigd: 'nee',
            vakantiegewijzigd: 'nee',
            studiegewijzigd: 'nee',
            vrijwilligerswerkgewijzigd: 'nee',
            vermogengewijzigd: 'nee',
            toelichtingingevuld: 'nee',
            pdf: 'https://example.com/documenten/api/v1/enkelvoudiginformatieobjecten/1',
            attachments: [],
          },
        },
        verloopdatum: '2025-05-21 00:00:00',
        identificatie: { type: 'bsn', value: '900026236' },
      },
      ...enrichedObjectOverrides,
    },
    filePaths: [`s3://bucket/${reference}/${reference}.pdf`],
    fileObjects: [{
      bucket: 'bucket',
      objectKey: `${reference}/${reference}.pdf`,
      fileName: `${reference}.pdf`,
      objectType: 'submission',
    }],
  };
}

describe('EsfProcessingHandler', () => {
  let store: jest.Mock;
  let handler: EsfProcessingHandler;

  beforeEach(() => {
    store = jest.fn().mockResolvedValue(undefined);
    handler = new EsfProcessingHandler({
      s3Uploader: { store } as unknown as S3Uploader,
      bucketName: 'bucket',
    });
  });

  test('stores the overview of changes next to the other files', async () => {
    await handler.handle(input());

    expect(store).toHaveBeenCalledTimes(1);
    const [kenmerk, filename, data, formaat, s3SubFolder] = store.mock.calls[0];
    expect(kenmerk).toBe(reference);
    expect(filename).toBe(`${reference}-wijzigingen.txt`);
    expect(formaat).toBe('text/plain; charset=utf-8');
    expect(s3SubFolder).toBeUndefined();
    const text = data.toString();
    expect(text).toContain('Email: niet gewijzigd');
    expect(text).toContain('    nieuw: 0632132131');
    expect(text).toContain('Aanpassing inkomen: Ja');
  });

  test('adds the overview to filePaths and fileObjects as attachment', async () => {
    const result = await handler.handle(input());

    expect(result.filePaths).toEqual([
      `s3://bucket/${reference}/${reference}.pdf`,
      `s3://bucket/${reference}/${reference}-wijzigingen.txt`,
    ]);
    expect(result.fileObjects).toEqual([
      {
        bucket: 'bucket',
        objectKey: `${reference}/${reference}.pdf`,
        fileName: `${reference}.pdf`,
        objectType: 'submission',
      },
      {
        bucket: 'bucket',
        objectKey: `${reference}/${reference}-wijzigingen.txt`,
        fileName: `${reference}-wijzigingen.txt`,
        objectType: 'attachment',
      },
    ]);
  });

  test('passes the enriched object on unchanged', async () => {
    const event = input();
    const result = await handler.handle(event);
    expect(result.enrichedObject).toEqual(event.enrichedObject);
  });

  test('uses the s3 subfolder when present', async () => {
    const result = await handler.handle(input({ s3SubFolder: 'esf' }));

    expect(store.mock.calls[0][4]).toBe('esf');
    expect(result.fileObjects[1].objectKey).toBe(`esf/${reference}/${reference}-wijzigingen.txt`);
    expect(result.filePaths[1]).toBe(`s3://bucket/esf/${reference}/${reference}-wijzigingen.txt`);
  });

  test('does not store an overview when nothing changed', async () => {
    const event = input();
    event.enrichedObject.taak.formtaak.verzonden_data.telefoon = '06123123123';
    event.enrichedObject.taak.formtaak.verzonden_data.inkomstengewijzigd = 'nee';

    const result = await handler.handle(event);

    expect(store).not.toHaveBeenCalled();
    expect(result.filePaths).toEqual(event.filePaths);
    expect(result.fileObjects).toEqual(event.fileObjects);
  });

  test('rejects input without an ESF taak', async () => {
    await expect(handler.handle(input({ taak: undefined }))).rejects.toThrow();
    expect(store).not.toHaveBeenCalled();
  });
});
