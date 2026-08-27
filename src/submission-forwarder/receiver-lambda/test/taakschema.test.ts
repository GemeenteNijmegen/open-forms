import { ZodError } from 'zod';
import * as taak from './samples/esfTaak.json';
import { EsfTaakSchema } from '../../shared/EsfTaak';
import { ObjectSchema } from '../../shared/ZgwObject';

/** Deep clone so mutating one test case cannot leak into another. */
function cloneTaakData(): any {
  return JSON.parse(JSON.stringify(taak)).record.data;
}

test('parses objects', async() => {
  expect(ObjectSchema.parse(taak)).toBeTruthy();
});

test('parses taak in objects', async() => {
  const object = ObjectSchema.parse(taak);
  console.debug(object.record.data);
  expect(EsfTaakSchema.parse(object.record.data)).toBeTruthy();
});

describe('EsfTaakSchema email validation', () => {
  test.each([
    ['missing @', 'not-an-email'],
    ['missing domain', 'someone@'],
    ['missing local part', '@example.com'],
    ['contains spaces', 'someone @example.com'],
    ['empty string', ''],
  ])('rejects verzonden_data.email that is %s', (_label, invalidEmail) => {
    const data = cloneTaakData();
    data.formtaak.verzonden_data.email = invalidEmail;

    expect(() => EsfTaakSchema.parse(data)).toThrow(ZodError);
  });

  test('accepts a valid verzonden_data.email', () => {
    const data = cloneTaakData();
    data.formtaak.verzonden_data.email = 'valid.address+tag@example.org';

    const parsed = EsfTaakSchema.parse(data);
    expect(parsed.formtaak.verzonden_data.email).toBe('valid.address+tag@example.org');
  });

  test('does NOT validate prefill formtaak.data.email (untrusted prefill data)', () => {
    const data = cloneTaakData();
    data.formtaak.data.email = 'clearly-not-an-email';

    // formtaak.data.email is a plain string by design, so this must still parse.
    expect(() => EsfTaakSchema.parse(data)).not.toThrow();
  });

  test('reports the offending field path in the ZodError', () => {
    const data = cloneTaakData();
    data.formtaak.verzonden_data.email = 'broken';

    try {
      EsfTaakSchema.parse(data);
      throw new Error('expected parse to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ZodError);
      const issue = (err as ZodError).issues[0];
      expect(issue.path).toEqual(['formtaak', 'verzonden_data', 'email']);
    }
  });
});
