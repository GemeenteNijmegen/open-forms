import * as tribeVerzoekFixture from '../../receiver-lambda/test/samples/tribeVerzoek.json';
import { ConfigurationError } from '../errors/ErrorTypes';
import { TribeProcessorHandler } from '../Handler';
import { ProcessorRegistry } from '../processors/ProcessorRegistry';
import { TribeSubmissionProcessor } from '../support/TribeSubmissionProcessor.type';

const request = tribeVerzoekFixture.record.data;
const fakeClient = { environment: 'AUTODELEN', authenticate: jest.fn(), get: jest.fn(), post: jest.fn() };

function fakeClientFactory(client = fakeClient) {
  return { create: jest.fn().mockResolvedValue({ client, clientIdSuffix: '****ABCD' }) } as any;
}

describe('TribeProcessorHandler', () => {
  test('happy path: selects the Autodelen processor, builds a client and returns its result', async () => {
    const processor: TribeSubmissionProcessor = { process: jest.fn().mockResolvedValue({ status: 'ok' }) };
    const registry = new ProcessorRegistry();
    registry.register('AUTODELEN', 'AUTODELEN_AANMELDING', processor);

    const handler = new TribeProcessorHandler({
      clientFactory: fakeClientFactory(),
      registry,
      dryRun: false,
    });

    const result = await handler.handle(request);
    expect(result).toEqual({ status: 'ok' });
  });

  test('passes the expected context fields to the processor', async () => {
    const processSpy = jest.fn().mockResolvedValue({ status: 'ok' });
    const registry = new ProcessorRegistry();
    registry.register('AUTODELEN', 'AUTODELEN_AANMELDING', { process: processSpy });

    const handler = new TribeProcessorHandler({
      clientFactory: fakeClientFactory(),
      registry,
      dryRun: true,
    });

    await handler.handle(request);

    const [, client, context] = processSpy.mock.calls[0];
    expect(client).toBe(fakeClient);
    expect(context).toEqual({
      reference: request.reference,
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
      dryRun: true,
    });
  });

  test('throws a ConfigurationError for an unknown environment/submissiontype combination', async () => {
    const registry = new ProcessorRegistry(); // nothing registered
    const handler = new TribeProcessorHandler({
      clientFactory: fakeClientFactory(),
      registry,
      dryRun: false,
    });

    await expect(handler.handle(request)).rejects.toBeInstanceOf(ConfigurationError);
  });

  test('throws a ConfigurationError when the client environment does not match the request environment', async () => {
    const registry = new ProcessorRegistry();
    registry.register('AUTODELEN', 'AUTODELEN_AANMELDING', { process: jest.fn() });

    const mismatchedClient = { ...fakeClient, environment: 'ENERGIELOKET' };
    const handler = new TribeProcessorHandler({
      clientFactory: fakeClientFactory(mismatchedClient),
      registry,
      dryRun: false,
    });

    await expect(handler.handle(request)).rejects.toBeInstanceOf(ConfigurationError);
  });

  test('rejects an object that does not satisfy the TribeVerzoek schema (missing required fields)', async () => {
    const registry = new ProcessorRegistry();
    const handler = new TribeProcessorHandler({ clientFactory: fakeClientFactory(), registry, dryRun: false });
    await expect(handler.handle({ foo: 'bar' })).rejects.toThrow();
  });
});
