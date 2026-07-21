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
import { MappingError } from '../errors/ErrorTypes';
import { mapAutodelenAanmelding } from '../mappers/autodelen-aanmelding';

interface FixtureCase {
  name: string;
  input: TribeVerzoek;
  output: Record<string, unknown>;
}

/**
 * Each case pairs a realistic incoming object (samples/autodelen/*.input.json)
 * with the exact JSON body Tribe would receive in the POST
 * (samples/autodelen/*.output.json), so the mapping is reviewable as plain
 * JSON rather than inline expect() objects.
 */
const cases: FixtureCase[] = [
  { name: 'volledig ingevuld', input: volledigInput as unknown as TribeVerzoek, output: volledigOutput },
  { name: 'minimaal (geen autodelen-object)', input: minimaalInput as unknown as TribeVerzoek, output: minimaalOutput },
  { name: 'lege velden', input: legeVeldenInput as unknown as TribeVerzoek, output: legeVeldenOutput },
  { name: 'alleen e-mail', input: alleenEmailInput as unknown as TribeVerzoek, output: alleenEmailOutput },
  { name: 'alleen telefoon', input: alleenTelefoonInput as unknown as TribeVerzoek, output: alleenTelefoonOutput },
  { name: 'hoeGevonden "anders" met toelichting', input: andersMetInput as unknown as TribeVerzoek, output: andersMetOutput },
  { name: 'hoeGevonden "anders" zonder toelichting', input: andersZonderInput as unknown as TribeVerzoek, output: andersZonderOutput },
];

describe('mapAutodelenAanmelding — fixture combinations', () => {
  test.each(cases)('$name: mapped payload matches the expected Tribe POST body', ({ input, output }) => {
    const payload = mapAutodelenAanmelding(input, { reference: input.reference });
    expect(payload).toEqual(output);
  });

  test('onbekende situatie-waarde gooit een terminale MappingError', () => {
    const request = onbekendeSituatieInput as unknown as TribeVerzoek;
    expect(() => mapAutodelenAanmelding(request, { reference: request.reference })).toThrow(MappingError);
  });
});
