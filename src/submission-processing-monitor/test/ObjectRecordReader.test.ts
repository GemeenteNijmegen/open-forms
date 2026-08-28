import { ObjectProcessingRules } from '../objects/ObjectProcessingRules';
import { ObjectRecordReader } from '../objects/ObjectRecordReader';
import { ObjectListItem, ObjectListRecord, ObjectsApiClient, ObjectsPage } from '../objects/ObjectsApiClient';
import { RuntimeBudget } from '../RuntimeBudget';
import esfTaakAfgerond from './samples/esf-taak/afgerond.json';
import esfTaakOpen from './samples/esf-taak/open.json';
import esfTaakVerwerkt from './samples/esf-taak/verwerkt.json';

function exhaustedBudget(): RuntimeBudget {
  return new RuntimeBudget(() => 0);
}

const SUBMISSION_TYPE_UUID = 'd3713c2b-307c-4c07-8eaa-c2c6d75869cf';
const ESF_TYPE_UUID = '6df21057-e07c-4909-8933-d70b79cfd15e';
const SUBMISSION_TYPE_URL = `https://example.com/objecttypes/api/v2/objecttypes/${SUBMISSION_TYPE_UUID}`;
const ESF_TYPE_URL = `https://example.com/objecttypes/api/v2/objecttypes/${ESF_TYPE_UUID}`;
const UNRELATED_TYPE_URL = 'https://example.com/objecttypes/api/v2/objecttypes/00000000-0000-0000-0000-000000000000';

const rules = new ObjectProcessingRules([
  { name: 'submission', uuid: SUBMISSION_TYPE_UUID },
  { name: 'esfTaak', uuid: ESF_TYPE_UUID },
]);

function objectListItem(uuid: string, index: number, registrationAt: string, typeUrl = SUBMISSION_TYPE_URL): ObjectListItem {
  return {
    url: `https://domein.nl/objects/api/v2/objects/${uuid}`,
    uuid,
    type: typeUrl,
    record: historyRecord(index, registrationAt),
  };
}

function historyRecord(index: number, registrationAt: string, reference = `OF-${index}`): ObjectListRecord {
  return {
    index,
    typeVersion: 1,
    data: { reference },
    startAt: registrationAt,
    endAt: null,
    registrationAt,
  };
}

function page<T>(results: T[], next: string | null = null): ObjectsPage<T> {
  return { count: results.length, next, results };
}

/** A minimal stand-in for ObjectsApiClient: returns the exact page we set up for each call, nothing dynamic. */
function stubClient(config: {
  objectsPages: ObjectsPage<ObjectListItem>[];
  historyPagesByUuid: Record<string, ObjectsPage<ObjectListRecord>[]>;
}): ObjectsApiClient {
  return {
    async listObjectsPage(params: { page: number; pageSize: number }) {
      const requestedPage = config.objectsPages[params.page - 1];
      if (!requestedPage) {
        throw new Error(`Test error: unexpected objects page requested: ${params.page}`);
      }
      return requestedPage;
    },
    async listObjectHistory(uuid: string, params: { page: number; pageSize: number }) {
      const pages = config.historyPagesByUuid[uuid];
      const requestedPage = pages?.[params.page - 1];
      if (!requestedPage) {
        throw new Error(`Test error: unexpected history page requested for ${uuid}: ${params.page}`);
      }
      return requestedPage;
    },
  } as unknown as ObjectsApiClient;
}

describe('ObjectRecordReader', () => {
  test('keeps the previous day\'s object record even when the object has a newer index today', async () => {
    const uuid = '714eb3e8-2db1-4da2-bacd-c2c08187ceaf';
    const client = stubClient({
      objectsPages: [page([objectListItem(uuid, 4, '2026-08-28')])],
      historyPagesByUuid: {
        [uuid]: [page([
          historyRecord(4, '2026-08-28'),
          historyRecord(3, '2026-08-27'),
        ])],
      },
    });

    const reader = new ObjectRecordReader(client, rules);
    const { records } = await reader.findRecordsInPeriod({ from: '2026-08-27', to: '2026-08-28' });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      objectUuid: uuid,
      objectIndex: 3,
      registrationAt: '2026-08-27',
      reference: 'OF-3',
      expectedProcessing: true,
    });
  });

  test('ignores objects of a type that is not configured for monitoring', async () => {
    const uuid = 'a1a1a1a1-0000-0000-0000-000000000001';
    const client = stubClient({
      objectsPages: [page([objectListItem(uuid, 1, '2026-08-27', UNRELATED_TYPE_URL)])],
      historyPagesByUuid: {},
    });

    const reader = new ObjectRecordReader(client, rules);
    const { records } = await reader.findRecordsInPeriod({ from: '2026-08-27', to: '2026-08-28' });

    expect(records).toHaveLength(0);
  });

  test('stops discovery once an object is provably older than the period, without fetching further pages', async () => {
    const newerUuid = 'a1a1a1a1-0000-0000-0000-000000000002';
    const olderUuid = 'b2b2b2b2-0000-0000-0000-000000000002';
    const client = stubClient({
      objectsPages: [
        page([
          objectListItem(newerUuid, 1, '2026-08-27'),
          objectListItem(olderUuid, 1, '2026-08-20'),
        ], 'https://domein.nl/objects/api/v2/objects?page=2'),
        // No second page configured: the reader must never request it.
      ],
      historyPagesByUuid: {
        [newerUuid]: [page([historyRecord(1, '2026-08-27')])],
      },
    });

    const reader = new ObjectRecordReader(client, rules);
    const { records } = await reader.findRecordsInPeriod({ from: '2026-08-27', to: '2026-08-28' });

    expect(records).toHaveLength(1);
    expect(records[0].objectUuid).toBe(newerUuid);
  });

  test('follows discovery pagination across multiple pages when every object is still in range', async () => {
    const firstUuid = 'c3c3c3c3-0000-0000-0000-000000000003';
    const secondUuid = 'd4d4d4d4-0000-0000-0000-000000000004';
    const client = stubClient({
      objectsPages: [
        page([objectListItem(firstUuid, 1, '2026-08-27')], 'https://domein.nl/objects/api/v2/objects?page=2'),
        page([objectListItem(secondUuid, 1, '2026-08-27')]),
      ],
      historyPagesByUuid: {
        [firstUuid]: [page([historyRecord(1, '2026-08-27')])],
        [secondUuid]: [page([historyRecord(1, '2026-08-27')])],
      },
    });

    const reader = new ObjectRecordReader(client, rules);
    const { records } = await reader.findRecordsInPeriod({ from: '2026-08-27', to: '2026-08-28' });

    expect(records.map(r => r.objectUuid).sort()).toEqual([firstUuid, secondUuid].sort());
  });

  test('follows history pagination for a single object across multiple pages', async () => {
    const uuid = 'e5e5e5e5-0000-0000-0000-000000000005';
    const client = stubClient({
      objectsPages: [page([objectListItem(uuid, 5, '2026-08-27')])],
      historyPagesByUuid: {
        [uuid]: [
          page([historyRecord(5, '2026-08-27')], 'https://domein.nl/objects/api/v2/objects/e5.../history?page=2'),
          page([historyRecord(4, '2026-08-26')]),
        ],
      },
    });

    const reader = new ObjectRecordReader(client, rules);
    const { records } = await reader.findRecordsInPeriod({ from: '2026-08-26', to: '2026-08-28' });

    expect(records.map(r => r.objectIndex).sort()).toEqual([4, 5]);
  });

  test('excludes a record registered exactly on the exclusive end of the period', async () => {
    const uuid = 'f6f6f6f6-0000-0000-0000-000000000006';
    const client = stubClient({
      objectsPages: [page([objectListItem(uuid, 1, '2026-08-28')])],
      historyPagesByUuid: {
        [uuid]: [page([historyRecord(1, '2026-08-28')])],
      },
    });

    const reader = new ObjectRecordReader(client, rules);
    const { records } = await reader.findRecordsInPeriod({ from: '2026-08-27', to: '2026-08-28' });

    expect(records).toHaveLength(0);
  });

  test('normalizes a real ESF taak that transitions from open to afgerond to verwerkt across its history', async () => {
    const uuid = 'a9a9a9a9-0000-0000-0000-000000000009';
    const openRecord: ObjectListRecord = { index: 1, typeVersion: 1, data: esfTaakOpen, startAt: '2026-08-25', endAt: null, registrationAt: '2026-08-25' };
    const afgerondRecord: ObjectListRecord = { index: 2, typeVersion: 1, data: esfTaakAfgerond, startAt: '2026-08-26', endAt: null, registrationAt: '2026-08-26' };
    const verwerktRecord: ObjectListRecord = { index: 3, typeVersion: 1, data: esfTaakVerwerkt, startAt: '2026-08-27', endAt: null, registrationAt: '2026-08-27' };

    const client = stubClient({
      objectsPages: [page([{ url: `https://domein.nl/objects/api/v2/objects/${uuid}`, uuid, type: ESF_TYPE_URL, record: verwerktRecord }])],
      historyPagesByUuid: {
        [uuid]: [page([verwerktRecord, afgerondRecord, openRecord])],
      },
    });

    const reader = new ObjectRecordReader(client, rules);
    const { records } = await reader.findRecordsInPeriod({ from: '2026-08-25', to: '2026-08-28' });

    expect(records).toHaveLength(3);
    const byIndex = Object.fromEntries(records.map(r => [r.objectIndex, r]));
    expect(byIndex[1]).toMatchObject({ esfStatus: 'open', expectedProcessing: false, reference: undefined, clientNumber: '32668' });
    expect(byIndex[2]).toMatchObject({ esfStatus: 'afgerond', expectedProcessing: true, reference: 'ESF-OF-P47KAS-96547-202510', clientNumber: '32668' });
    expect(byIndex[3]).toMatchObject({ esfStatus: 'verwerkt', expectedProcessing: false, reference: 'ESF-OF-P47KAS-96547-202510', clientNumber: '32668' });
  });

  test('reports complete: true when no runtime budget is given', async () => {
    const uuid = 'aaaaaaaa-1111-0000-0000-000000000001';
    const client = stubClient({
      objectsPages: [page([objectListItem(uuid, 1, '2026-08-27')])],
      historyPagesByUuid: { [uuid]: [page([historyRecord(1, '2026-08-27')])] },
    });

    const reader = new ObjectRecordReader(client, rules);
    const result = await reader.findRecordsInPeriod({ from: '2026-08-27', to: '2026-08-28' });

    expect(result.complete).toBe(true);
  });

  test('stops before the first discovery page and reports complete: false when the runtime budget is already exhausted', async () => {
    const client = stubClient({ objectsPages: [], historyPagesByUuid: {} });
    const reader = new ObjectRecordReader(client, rules);

    const result = await reader.findRecordsInPeriod({ from: '2026-08-27', to: '2026-08-28' }, exhaustedBudget());

    expect(result).toEqual({ records: [], objectsScanned: 0, complete: false });
  });

  test('stops before fetching a candidate\'s history once the runtime budget runs out, without losing records already found', async () => {
    const firstUuid = 'bbbbbbbb-2222-0000-0000-000000000002';
    const secondUuid = 'cccccccc-3333-0000-0000-000000000003';
    const client = stubClient({
      objectsPages: [page([
        objectListItem(firstUuid, 1, '2026-08-27'),
        objectListItem(secondUuid, 1, '2026-08-27'),
      ])],
      historyPagesByUuid: {
        [firstUuid]: [page([historyRecord(1, '2026-08-27')])],
        [secondUuid]: [page([historyRecord(1, '2026-08-27')])],
      },
    });
    const reader = new ObjectRecordReader(client, rules);

    let calls = 0;
    const runtimeBudget = new RuntimeBudget(() => {
      calls += 1;
      // Time remains for discovery and the first candidate's history, runs out right after.
      return calls <= 2 ? 300_000 : 0;
    });

    const result = await reader.findRecordsInPeriod({ from: '2026-08-27', to: '2026-08-28' }, runtimeBudget);

    expect(result.complete).toBe(false);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].objectUuid).toBe(firstUuid);
  });
});
