import * as tribeVerzoekFixture from '../../../receiver-lambda/test/samples/tribeVerzoek.json';
import { TribeVerzoek } from '../../../shared/TribeVerzoek';
import { MappingError, TribeAuthenticationError, TribeRequestError } from '../../errors/ErrorTypes';
import { TribeProcessingContext } from '../../support/TribeSubmissionProcessor.type';
import { createAutodelenAanmeldingProcessor } from '../autodelen-aanmelding';

jest.mock('../../../shared/trace', () => ({ trace: jest.fn().mockResolvedValue(undefined) }));
// eslint-disable-next-line import/order
import { trace } from '../../../shared/trace';

function fakeClient() {
  return {
    environment: 'AUTODELEN',
    authenticate: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    post: jest.fn().mockResolvedValue({ ID: 'not-used' }),
  };
}

function fakeLogger() {
  return { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn(), appendKeys: jest.fn() } as any;
}

const request = tribeVerzoekFixture.record.data as unknown as TribeVerzoek;

const context: TribeProcessingContext = {
  reference: 'OF-TEST123',
  tribeEnvironment: 'AUTODELEN',
  tribeSubmissionType: 'AUTODELEN_AANMELDING',
  dryRun: false,
};

beforeEach(() => jest.clearAllMocks());

describe('autodelenAanmeldingProcessor', () => {
  test('success: authenticates, POSTs the mapped payload, traces OK, returns ok', async () => {
    const client = fakeClient();
    const logger = fakeLogger();
    const processor = createAutodelenAanmeldingProcessor(logger);

    const result = await processor.process(request, client as any, context);

    expect(client.authenticate).toHaveBeenCalledTimes(1);
    expect(client.post).toHaveBeenCalledTimes(1);
    const [entitySet, payload] = client.post.mock.calls[0];
    expect(entitySet).toBe('_3881e9fc__a770__47ab__a547__091ca1bd5fc7');
    expect(payload).toBeTruthy();
    expect(trace).toHaveBeenCalledWith('OF-TEST123', 'tribe_processor', 'OK');
    expect(result).toEqual({ status: 'ok' });
  });

  test('dry-run: authenticates but never POSTs, traces DRY_RUN, returns dry-run', async () => {
    const client = fakeClient();
    const logger = fakeLogger();
    const processor = createAutodelenAanmeldingProcessor(logger);

    const result = await processor.process(request, client as any, { ...context, dryRun: true });

    expect(client.authenticate).toHaveBeenCalledTimes(1);
    expect(client.post).not.toHaveBeenCalled();
    expect(trace).toHaveBeenCalledWith('OF-TEST123', 'tribe_processor', 'DRY_RUN');
    expect(result).toEqual({ status: 'dry-run' });
  });

  test('dry-run logs the mapped payload only at debug level (accp-only in practice)', async () => {
    const client = fakeClient();
    const logger = fakeLogger();
    const processor = createAutodelenAanmeldingProcessor(logger);

    await processor.process(request, client as any, { ...context, dryRun: true });

    expect(logger.debug).toHaveBeenCalledWith('tribe_dry_run_payload', expect.anything());
    // never at info/error level, which would be visible on every log level in every environment
    expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('payload'), expect.anything());
  });

  test('a mapping error (unknown choice value) is terminal and never reaches the client', async () => {
    const client = fakeClient();
    const processor = createAutodelenAanmeldingProcessor(fakeLogger());
    const badRequest = { ...request, autodelen: { ...request.autodelen, situatie: 'eenOnbekendeWaarde' } };

    await expect(processor.process(badRequest, client as any, context)).rejects.toBeInstanceOf(MappingError);
    expect(client.authenticate).not.toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalled();
  });

  test('an authentication failure propagates and never reaches post()', async () => {
    const client = fakeClient();
    client.authenticate.mockRejectedValue(new TribeAuthenticationError('boom', true));
    const processor = createAutodelenAanmeldingProcessor(fakeLogger());

    await expect(processor.process(request, client as any, context)).rejects.toBeInstanceOf(TribeAuthenticationError);
    expect(client.post).not.toHaveBeenCalled();
  });

  test('a Tribe 4xx (non-retryable) propagates as-is', async () => {
    const client = fakeClient();
    client.post.mockRejectedValue(new TribeRequestError('bad request', false, 400));
    const processor = createAutodelenAanmeldingProcessor(fakeLogger());

    await expect(processor.process(request, client as any, context)).rejects.toMatchObject({ retryable: false, status: 400 });
  });

  test('a Tribe 5xx/timeout (retryable) propagates as-is', async () => {
    const client = fakeClient();
    client.post.mockRejectedValue(new TribeRequestError('server error', true, 503));
    const processor = createAutodelenAanmeldingProcessor(fakeLogger());

    await expect(processor.process(request, client as any, context)).rejects.toMatchObject({ retryable: true, status: 503 });
  });

  test('trace is called with only the reference and a status keyword, never the payload or PII', async () => {
    const client = fakeClient();
    const processor = createAutodelenAanmeldingProcessor(fakeLogger());

    await processor.process(request, client as any, context);

    const [, , message] = (trace as jest.Mock).mock.calls[0];
    expect(message).toBe('OK');
    expect((trace as jest.Mock).mock.calls[0].join(' ')).not.toContain('Jansen');
  });
});
