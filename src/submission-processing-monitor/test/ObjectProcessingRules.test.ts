import { ObjectProcessingRules, parseObjectTypesConfig } from '../objects/ObjectProcessingRules';
import aanvraagSociaalDomein from './samples/aanvraag-sociaal-domein/aanvraag.json';
import esfTaakAfgerond from './samples/esf-taak/afgerond.json';
import esfTaakOpen from './samples/esf-taak/open.json';
import esfTaakVerwerkt from './samples/esf-taak/verwerkt.json';
import nijmegenverzoek from './samples/submission/nijmegenverzoek.json';

const SUBMISSION_TYPE_UUID = 'd3713c2b-307c-4c07-8eaa-c2c6d75869cf';
const ESF_TYPE_UUID = '6df21057-e07c-4909-8933-d70b79cfd15e';
const AANVRAAG_SOCIAAL_DOMEIN_TYPE_UUID = '167e0aec-e416-46fa-9868-e35f11f3f151';
const SUBMISSION_TYPE_URL = `https://example.com/objecttypes/api/v2/objecttypes/${SUBMISSION_TYPE_UUID}`;
const ESF_TYPE_URL = `https://example.com/objecttypes/api/v2/objecttypes/${ESF_TYPE_UUID}`;
const AANVRAAG_SOCIAAL_DOMEIN_TYPE_URL = `https://example.com/objecttypes/api/v2/objecttypes/${AANVRAAG_SOCIAAL_DOMEIN_TYPE_UUID}`;

const rules = new ObjectProcessingRules([
  { name: 'submission', uuid: SUBMISSION_TYPE_UUID },
  { name: 'esfTaak', uuid: ESF_TYPE_UUID },
  { name: 'aanvraagsociaaldomein', uuid: AANVRAAG_SOCIAAL_DOMEIN_TYPE_UUID },
]);

describe('parseObjectTypesConfig', () => {
  test('parses semicolon-separated name##uuid pairs', () => {
    const parsed = parseObjectTypesConfig(`submission##${SUBMISSION_TYPE_UUID};esftaak##${ESF_TYPE_UUID}`);
    expect(parsed).toEqual([
      { name: 'submission', uuid: SUBMISSION_TYPE_UUID },
      { name: 'esftaak', uuid: ESF_TYPE_UUID },
    ]);
  });

  test('rejects an entry that is not in the name##uuid form', () => {
    expect(() => parseObjectTypesConfig('submission-without-a-uuid')).toThrow();
  });
});

describe('ObjectProcessingRules.resolve', () => {
  test('matches the trailing objecttype uuid regardless of the rest of the URL', () => {
    expect(rules.resolve(SUBMISSION_TYPE_URL)?.name).toBe('submission');
    expect(rules.resolve(SUBMISSION_TYPE_URL.toUpperCase())?.name).toBe('submission');
  });

  test('returns undefined for an object type that is not configured for monitoring', () => {
    expect(rules.resolve('https://example.com/objecttypes/api/v2/objecttypes/00000000-0000-0000-0000-000000000000')).toBeUndefined();
  });
});

describe('ObjectProcessingRules.normalize', () => {
  test('normalizes a real submission record, always expecting processing', () => {
    const record = rules.normalize({
      objectUuid: 'uuid-1',
      objectType: SUBMISSION_TYPE_URL,
      record: { index: 3, typeVersion: 1, data: nijmegenverzoek, startAt: '2026-08-27', endAt: null, registrationAt: '2026-08-27' },
    });

    expect(record).toMatchObject({
      objectUuid: 'uuid-1',
      objectIndex: 3,
      objectType: SUBMISSION_TYPE_URL,
      processingKind: 'REGULAR',
      registrationAt: '2026-08-27',
      reference: 'OF-XN6DEA',
      expectedProcessing: true,
    });
  });

  test('normalizes a real aanvraagSociaalDomein record the same way as a regular submission', () => {
    const record = rules.normalize({
      objectUuid: 'uuid-1b',
      objectType: AANVRAAG_SOCIAAL_DOMEIN_TYPE_URL,
      record: { index: 1, typeVersion: 1, data: aanvraagSociaalDomein, startAt: '2026-08-27', endAt: null, registrationAt: '2026-08-27' },
    });

    expect(record).toMatchObject({ reference: 'OF-XNCBEA', expectedProcessing: true });
  });

  test('normalizes an afgerond ESF taak, reconstructing the reference in the receiver\'s existing form', () => {
    const record = rules.normalize({
      objectUuid: 'uuid-2',
      objectType: ESF_TYPE_URL,
      record: {
        index: 1,
        typeVersion: 1,
        registrationAt: '2026-08-27',
        startAt: '2026-08-27',
        endAt: null,
        data: {
          status: 'afgerond',
          formtaak: {
            data: { dossiernummer: 'DOS-1', periodenummer: 'PER-1' },
            verzonden_data: { formulierreferentie: 'FORM-1' },
          },
        },
      },
    });

    expect(record).toMatchObject({
      processingKind: 'ESF',
      esfStatus: 'afgerond',
      expectedProcessing: true,
      reference: 'ESF-FORM-1-DOS-1-PER-1',
    });
  });

  test('does not expect processing for an ESF taak that is not afgerond, but still takes the client number along', () => {
    const record = rules.normalize({
      objectUuid: 'uuid-3',
      objectType: ESF_TYPE_URL,
      record: {
        index: 1,
        typeVersion: 1,
        registrationAt: '2026-08-27',
        startAt: '2026-08-27',
        endAt: null,
        data: { status: 'open', formtaak: { data: { clientnummer: '32668' }, verzonden_data: {} } },
      },
    });

    expect(record).toMatchObject({ esfStatus: 'open', expectedProcessing: false, dataValid: true, reference: undefined, clientNumber: '32668' });
  });

  test('reports invalid data for an ESF taak with a missing or unknown status, but keeps processingKind ESF - identity comes from the configured object type, not esfStatus', () => {
    const record = rules.normalize({
      objectUuid: 'uuid-invalid',
      objectType: ESF_TYPE_URL,
      record: {
        index: 1,
        typeVersion: 1,
        registrationAt: '2026-08-27',
        startAt: '2026-08-27',
        endAt: null,
        data: { formtaak: { data: { clientnummer: '32668' }, verzonden_data: {} } },
      },
    });

    expect(record).toMatchObject({ processingKind: 'ESF', dataValid: false, expectedProcessing: false, esfStatus: undefined });
  });

  test('normalizes real open, verwerkt and afgerond ESF taak samples, keeping the client number in all three', () => {
    const openRecord = rules.normalize({
      objectUuid: 'uuid-open',
      objectType: ESF_TYPE_URL,
      record: { index: 1, typeVersion: 1, registrationAt: '2025-10-15', startAt: '2025-10-15', endAt: null, data: esfTaakOpen },
    });
    const verwerktRecord = rules.normalize({
      objectUuid: 'uuid-verwerkt',
      objectType: ESF_TYPE_URL,
      record: { index: 2, typeVersion: 1, registrationAt: '2025-10-18', startAt: '2025-10-18', endAt: null, data: esfTaakVerwerkt },
    });
    const afgerondRecord = rules.normalize({
      objectUuid: 'uuid-afgerond',
      objectType: ESF_TYPE_URL,
      record: { index: 3, typeVersion: 1, registrationAt: '2025-10-20', startAt: '2025-10-20', endAt: null, data: esfTaakAfgerond },
    });

    expect(openRecord).toMatchObject({ esfStatus: 'open', expectedProcessing: false, reference: undefined, clientNumber: '32668' });
    expect(verwerktRecord).toMatchObject({
      esfStatus: 'verwerkt',
      expectedProcessing: false,
      reference: 'ESF-OF-P47KAS-96547-202510',
      clientNumber: '32668',
    });
    expect(afgerondRecord).toMatchObject({
      esfStatus: 'afgerond',
      expectedProcessing: true,
      reference: 'ESF-OF-P47KAS-96547-202510',
      clientNumber: '32668',
    });
  });

  test('returns undefined for an object type that is not configured for monitoring', () => {
    const record = rules.normalize({
      objectUuid: 'uuid-4',
      objectType: 'https://example.com/objecttypes/api/v2/objecttypes/00000000-0000-0000-0000-000000000000',
      record: { index: 1, typeVersion: 1, data: {}, startAt: '2026-08-27', endAt: null, registrationAt: '2026-08-27' },
    });

    expect(record).toBeUndefined();
  });
});
