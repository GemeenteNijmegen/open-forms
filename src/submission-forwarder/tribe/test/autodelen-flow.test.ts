import alleenEmailInput from './samples/autodelen/alleen-email.input.json';
import alleenEmailOutput from './samples/autodelen/alleen-email.output.json';
import alleenTelefoonInput from './samples/autodelen/alleen-telefoon.input.json';
import alleenTelefoonOutput from './samples/autodelen/alleen-telefoon.output.json';
import andersMetInput from './samples/autodelen/hoe-gevonden-anders-met-toelichting.input.json';
import andersMetOutput from './samples/autodelen/hoe-gevonden-anders-met-toelichting.output.json';
import andersZonderInput from './samples/autodelen/hoe-gevonden-anders-zonder-toelichting.input.json';
import andersZonderOutput from './samples/autodelen/hoe-gevonden-anders-zonder-toelichting.output.json';
import legeVeldenInput from './samples/autodelen/lege-velden.input.json';
import legeVeldenOutput from './samples/autodelen/lege-velden.output.json';
import minimaalInput from './samples/autodelen/minimaal.input.json';
import minimaalOutput from './samples/autodelen/minimaal.output.json';
import onbekendeSituatieInput from './samples/autodelen/onbekende-situatie.input.json';
import volledigInput from './samples/autodelen/volledig-ingevuld.input.json';
import volledigOutput from './samples/autodelen/volledig-ingevuld.output.json';
import { TribeVerzoek } from '../../shared/TribeVerzoek';
import { TribeClientFactory } from '../client/TribeClientFactory';
import { TribeHttpClient } from '../client/TribeHttpClient';
import { AUTODELEN_ENTITY } from '../constants/autodelen';
import { TribeProcessorHandler } from '../Handler';
import { autodelenAanmeldingProcessor } from '../processors/autodelen-aanmelding';
import { ProcessorRegistry } from '../processors/ProcessorRegistry';

const BASE_URL = 'https://tribe.example.com/v1/odata/';

function mockResponse(ok: boolean, status: number, jsonBody: unknown): Response {
  return { ok, status, json: async () => jsonBody } as unknown as Response;
}

/**
 * Builds a handler wired up exactly like the real Lambda: the actual
 * Handler, ProcessorRegistry, autodelen processor and TribeHttpClient. Only
 * the injected `fetchFn` is fake, so this exercises the real request
 * building (URL, headers, JSON body) all the way down.
 */
function buildHandler(fetchFn: jest.Mock, dryRun = false): TribeProcessorHandler {
  const client = new TribeHttpClient({
    environment: 'AUTODELEN',
    baseUrl: BASE_URL,
    tokenUrl: 'https://tribe.example.com/oauth2/token',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    scope: 'read write offline',
    fetchFn: fetchFn as unknown as typeof fetch,
  });
  const clientFactory = {
    create: jest.fn().mockResolvedValue({ client, clientIdSuffix: '****TEST' }),
  } as unknown as TribeClientFactory;

  const registry = new ProcessorRegistry();
  registry.register('AUTODELEN', 'AUTODELEN_AANMELDING', autodelenAanmeldingProcessor);

  return new TribeProcessorHandler({ clientFactory, registry, dryRun });
}

interface FixtureCase {
  name: string;
  input: TribeVerzoek;
  output: Record<string, unknown>;
}

/** Same input/output fixture pairs as autodelen-mapping.test.ts, exercised through the full flow instead of the mapper alone. */
const cases: FixtureCase[] = [
  { name: 'volledig ingevuld', input: volledigInput as unknown as TribeVerzoek, output: volledigOutput },
  { name: 'minimaal (geen autodelen-object)', input: minimaalInput as unknown as TribeVerzoek, output: minimaalOutput },
  { name: 'lege velden', input: legeVeldenInput as unknown as TribeVerzoek, output: legeVeldenOutput },
  { name: 'alleen e-mail', input: alleenEmailInput as unknown as TribeVerzoek, output: alleenEmailOutput },
  { name: 'alleen telefoon', input: alleenTelefoonInput as unknown as TribeVerzoek, output: alleenTelefoonOutput },
  { name: 'hoeGevonden "anders" met toelichting', input: andersMetInput as unknown as TribeVerzoek, output: andersMetOutput },
  { name: 'hoeGevonden "anders" zonder toelichting', input: andersZonderInput as unknown as TribeVerzoek, output: andersZonderOutput },
];

describe('Tribe Autodelen end-to-end flow (Tribe call mocked)', () => {
  test.each(cases)('$name: the POST body sent to Tribe matches the expected fixture', async ({ input, output }) => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(mockResponse(true, 200, { access_token: 'token-abc' }))
      .mockResolvedValueOnce(mockResponse(true, 201, { ID: 'created-1' }));

    const result = await buildHandler(fetchFn).handle(input);

    expect(result).toEqual({ status: 'ok' });
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const [postUrl, postInit] = fetchFn.mock.calls[1];
    expect(postUrl).toBe(`${BASE_URL}${AUTODELEN_ENTITY.ENTITY_TYPE}`);
    expect(JSON.parse(postInit.body)).toEqual(output);
  });

  test('dry run: authenticates but never sends the POST to Tribe', async () => {
    const fetchFn = jest.fn().mockResolvedValueOnce(mockResponse(true, 200, { access_token: 'token-abc' }));

    const result = await buildHandler(fetchFn, true).handle(volledigInput as unknown as TribeVerzoek);

    expect(result).toEqual({ status: 'dry-run' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('onbekende situatie-waarde: mapping fails before Tribe is ever called', async () => {
    const fetchFn = jest.fn();

    await expect(buildHandler(fetchFn).handle(onbekendeSituatieInput)).rejects.toThrow();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
