import { AWS } from '@gemeentenijmegen/utils';
import { ObjectReader } from '../ObjectReader';
import { ObjectsApiError } from '../ObjectsApiClient';

jest.mock('@gemeentenijmegen/utils', () => ({
  AWS: {
    getParameter: jest.fn(),
    getSecret: jest.fn(),
  },
}));

const baseUrl = 'https://objects.example.com/api/v2';
const esfTaakUuid = '6df21057-e07c-4909-8933-d70b79cfd15e';
const submissionTypeUrl = 'https://objecttypes.example.com/api/v2/objecttypes/d3713c2b-307c-4c07-8eaa-c2c6d75869cf';
const esfTaakTypeUrl = `https://objecttypes.example.com/api/v2/objecttypes/${esfTaakUuid}`;
const otherTypeUrl = 'https://objecttypes.example.com/api/v2/objecttypes/11111111-1111-1111-1111-111111111111';

// The list is sorted newest current record first. Page 2 ends with an Object from before the period, so page 3 must never be read.
const objectPages: Record<string, unknown> = {
  [`${baseUrl}/objects?ordering=-record__registrationAt&pageSize=100`]: {
    next: `${baseUrl}/objects?ordering=-record__registrationAt&pageSize=100&page=2`,
    results: [
      { uuid: 'submission-changed-later', type: submissionTypeUrl, record: { registrationAt: '2026-11-20' } },
      { uuid: 'esf-taak', type: esfTaakTypeUrl, record: { registrationAt: '2026-11-17' } },
    ],
  },
  [`${baseUrl}/objects?ordering=-record__registrationAt&pageSize=100&page=2`]: {
    next: `${baseUrl}/objects?ordering=-record__registrationAt&pageSize=100&page=3`,
    results: [
      { uuid: 'other-type', type: otherTypeUrl, record: { registrationAt: '2026-11-17' } },
      { uuid: 'before-period', type: submissionTypeUrl, record: { registrationAt: '2026-11-10' } },
    ],
  },
  [`${baseUrl}/objects/submission-changed-later/history?pageSize=100`]: {
    next: null,
    results: [
      { index: 1, registrationAt: '2026-11-17', data: { status: 'not an esf status' } },
      { index: 2, registrationAt: '2026-11-20', data: {} },
    ],
  },
  [`${baseUrl}/objects/esf-taak/history?pageSize=100`]: {
    next: null,
    results: [
      { index: 1, registrationAt: '2026-11-17', data: { status: 'open' } },
      { index: 2, registrationAt: '2026-11-17', data: { status: 'afgerond' } },
      { index: 3, registrationAt: '2026-11-17', data: { status: 'verwerkt' } },
    ],
  },
};

let requestedUrls: string[];

beforeEach(() => {
  requestedUrls = [];
  jest.mocked(AWS.getParameter).mockImplementation(async (name: string) => {
    return name.endsWith('objects-api-base-url') ? baseUrl : `esfTaak##${esfTaakUuid};submission##${submissionTypeUrl}`;
  });
  jest.mocked(AWS.getSecret).mockResolvedValue('fake-token');
  jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
    requestedUrls.push(String(url));
    const page = objectPages[String(url)];
    return page ? new Response(JSON.stringify(page)) : new Response('{"detail":"Not found."}', { status: 404 });
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ObjectReader.findVersions', () => {
  test('finds every version in the period, also of an Object changed later, and stops the list before the period', async () => {
    const versions = await new ObjectReader().findVersions({ firstDay: '2026-11-17', lastDay: '2026-11-17' });

    expect(versions).toEqual([
      { objectUuid: 'submission-changed-later', objectType: submissionTypeUrl, objectTypeName: 'submission', index: 1, registrationAt: '2026-11-17' },
      { objectUuid: 'esf-taak', objectType: esfTaakTypeUrl, objectTypeName: 'esfTaak', index: 1, registrationAt: '2026-11-17', esfStatus: 'open' },
      { objectUuid: 'esf-taak', objectType: esfTaakTypeUrl, objectTypeName: 'esfTaak', index: 2, registrationAt: '2026-11-17', esfStatus: 'afgerond' },
      { objectUuid: 'esf-taak', objectType: esfTaakTypeUrl, objectTypeName: 'esfTaak', index: 3, registrationAt: '2026-11-17', esfStatus: 'verwerkt' },
    ]);
    // No history for the other object type, and no page 3 after the Object from before the period.
    expect(requestedUrls).toEqual([
      `${baseUrl}/objects?ordering=-record__registrationAt&pageSize=100`,
      `${baseUrl}/objects?ordering=-record__registrationAt&pageSize=100&page=2`,
      `${baseUrl}/objects/submission-changed-later/history?pageSize=100`,
      `${baseUrl}/objects/esf-taak/history?pageSize=100`,
    ]);
  });

  test('a failed page throws instead of returning a partial result', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/esf-taak/history')) {
        return new Response('{"detail":"Server error."}', { status: 500 });
      }
      return new Response(JSON.stringify(objectPages[String(url)]));
    });

    await expect(new ObjectReader().findVersions({ firstDay: '2026-11-17', lastDay: '2026-11-17' })).rejects.toThrow(ObjectsApiError);
  });
});
