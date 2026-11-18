jest.mock('@aws-lambda-powertools/logger');
jest.mock('@aws-sdk/client-s3');
jest.mock('@gemeentenijmegen/utils', () => ({
  environmentVariables: () => ({ SUBMISSION_BUCKET_NAME: 'bucket' }),
}));
jest.mock('../../documentsToS3Storage/S3Uploader');
jest.mock('../EsfProcessingHandler');

// Mocks needed before handler (and others) is imported
import { handler } from '../esf-processing.lambda';
import { EsfProcessingHandler } from '../EsfProcessingHandler';

describe('esf processing lambda handler', () => {
  const event = { enrichedObject: { reference: 'ESF-OF-123456-12345678-202510' }, filePaths: [], fileObjects: [] };
  const mockHandle = EsfProcessingHandler.prototype.handle as jest.Mock;

  beforeEach(() => {
    mockHandle.mockReset();
  });

  test('returns the processed event', async () => {
    const processed = { ...event, filePaths: ['s3://bucket/wijzigingen.txt'] };
    mockHandle.mockResolvedValue(processed);

    await expect(handler(event)).resolves.toBe(processed);
    expect(mockHandle).toHaveBeenCalledWith(event);
  });

  test('forwards the original event when processing fails', async () => {
    mockHandle.mockRejectedValue(new Error('S3 unavailable'));

    await expect(handler(event)).resolves.toBe(event);
  });

  test('forwards the original event when the event does not match the schema', async () => {
    mockHandle.mockImplementation(() => {
      throw new Error('Invalid input');
    });

    await expect(handler(event)).resolves.toBe(event);
  });
});
