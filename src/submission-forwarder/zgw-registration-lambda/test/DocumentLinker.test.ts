import { Logger } from '@aws-lambda-powertools/logger';
import * as zaken from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { DocumentLinker, DocumentLinkerConfig } from '../collaborators/DocumentLinker';
import { ZGWRegistrationSubmission } from '../ZGWRegistrationSubmission';

jest.mock('@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client');

describe('DocumentLinker', () => {
  let mockClient: any;
  let mockLogger: Logger;
  let linker: DocumentLinker;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {} as any;
    mockLogger = new Logger() as any;
    mockLogger.debug = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    const config: DocumentLinkerConfig = {
      zakenClient: mockClient,
      logger: mockLogger,
    };
    linker = new DocumentLinker(config);
  });

  describe('linkAllDocuments', () => {
    it('should succeed when pdf and attachments link without error', async () => {
      const submission: ZGWRegistrationSubmission = {
        reference: 'REF',
        zaaktypeIdentificatie: 'ZT',
        pdf: 'http://pdf.file.pdf',
        attachments: ['http://att/a1', 'http://att/a2'],
      } as any;

      const mockApi = {
        zaakinformatieobjectList: jest.fn().mockResolvedValue({ data: [] }),
        zaakinformatieobjectCreate: jest.fn().mockResolvedValue({ data: { uuid: 'u1' } }),
      };
      (zaken.Zaakinformatieobjecten as jest.Mock).mockImplementation(() => mockApi);

      await linker.linkAllDocuments(submission, 'http://zaak/url');

      expect(mockApi.zaakinformatieobjectCreate).toHaveBeenCalledTimes(3);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'SUCCESS Documentlinker: all files were linked to REF',
      );
    });

    it('should throw and log errors when one attachment fails', async () => {
      const submission = {
        reference: 'REF2',
        zaaktypeIdentificatie: 'ZT2',
        pdf: 'http://pdf.f2',
        attachments: ['http://att/good', 'http://att/bad'],
      } as any;

      const mockApi = {
        zaakinformatieobjectList: jest.fn().mockResolvedValue({ data: [] }),
        zaakinformatieobjectCreate: jest.fn()
          .mockResolvedValueOnce({ data: { uuid: 'ok' } })
          .mockResolvedValueOnce({ data: { uuid: 'ok2' } })
          .mockRejectedValueOnce(new Error('fail-one')),
      };
      (zaken.Zaakinformatieobjecten as jest.Mock).mockImplementation(() => mockApi);

      await expect(linker.linkAllDocuments(submission, 'http://zaak/u2'))
        .rejects.toThrow(/Adding 1 documents failed for REF2 ZT2/);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Adding (some) documents failed for REF2 ZT2'),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('0 fail: http://att/bad with error Error: fail-one'),
      );
    });

    it('should skip files already linked but create for new ones', async () => {
      const submission: ZGWRegistrationSubmission = {
        reference: 'REF3',
        zaaktypeIdentificatie: 'ZT3',
        pdf: 'http://pdf.already',
        attachments: ['http://att/one', 'http://att/skip'],
      } as any;

      const mockList = jest.fn().mockResolvedValue({
        data: [
          { informatieobject: 'http://pdf.already' },
          { informatieobject: 'http://att/skip' },
        ],
      });
      const mockCreate = jest.fn().mockResolvedValue({ data: { uuid: 'u-one' } });

      const mockApi = {
        zaakinformatieobjectList: mockList,
        zaakinformatieobjectCreate: mockCreate,
      };
      (zaken.Zaakinformatieobjecten as jest.Mock).mockImplementation(() => mockApi);

      await linker.linkAllDocuments(submission, 'http://zaak/skiptest');

      expect(mockList).toHaveBeenCalledWith({ zaak: 'http://zaak/skiptest' });
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        zaak: 'http://zaak/skiptest',
        informatieobject: 'http://att/one',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Skipping http://pdf.already'),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Skipping http://att/skip'),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Added attachment'),
      );
    });
  });

  describe('linkFileToZaak', () => {
    it('should catch exception and push to errors array', async () => {
      const mockApi = {
        zaakinformatieobjectList: jest.fn(),
        zaakinformatieobjectCreate: jest.fn().mockRejectedValue(new Error('network')),
      };
      (zaken.Zaakinformatieobjecten as jest.Mock).mockImplementation(() => mockApi);

      await linker.linkFileToZaak('http://zaak/x', 'http://file/y');

      expect(linker.errors).toHaveLength(1);
      expect(linker.errors[0].fileUrl).toBe('http://file/y');
      expect(linker.errors[0].error).toBeInstanceOf(Error);
    });

    it('should log debug on success', async () => {
      const mockApi = {
        zaakinformatieobjectList: jest.fn(),
        zaakinformatieobjectCreate: jest.fn().mockResolvedValue({ data: { uuid: 'ABC' } }),
      };
      (zaken.Zaakinformatieobjecten as jest.Mock).mockImplementation(() => mockApi);

      await linker.linkFileToZaak('http://zaak/z', 'http://file/ok');

      expect(linker.errors).toHaveLength(0);
    });
  });
});
