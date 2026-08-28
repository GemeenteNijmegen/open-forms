import { DescribeExecutionCommand, ExecutionStatus, ListExecutionsCommand, SFNClient } from '@aws-sdk/client-sfn';
import { mockClient } from 'aws-sdk-client-mock';
import { SubmissionExecutionReader } from '../executions/SubmissionExecutionReader';
import { ObjectProcessingRules } from '../objects/ObjectProcessingRules';
import { ObjectRecordReader } from '../objects/ObjectRecordReader';
import { ObjectsApiClient } from '../objects/ObjectsApiClient';
import { checkProcessing } from '../processing/SubmissionProcessingChecker';
import ambiguousExecutionsDetail from './samples/ambiguous-day/executions-detail.json';
import ambiguousExecutionsList from './samples/ambiguous-day/executions-list.json';
import ambiguousExpectedResults from './samples/ambiguous-day/expected-results.json';
import ambiguousHistories from './samples/ambiguous-day/histories.json';
import ambiguousObjects from './samples/ambiguous-day/objects.json';
import executionsDetail from './samples/normal-day/executions-detail.json';
import executionsList from './samples/normal-day/executions-list.json';
import expectedResults from './samples/normal-day/expected-results.json';
import histories from './samples/normal-day/histories.json';
import objectsPage1 from './samples/normal-day/objects-page-1.json';
import objectsPage2 from './samples/normal-day/objects-page-2.json';

const SUBMISSION_TYPE_UUID = 'd3713c2b-307c-4c07-8eaa-c2c6d75869cf';
const ESF_TYPE_UUID = '6df21057-e07c-4909-8933-d70b79cfd15e';
const STATE_MACHINE_ARN = 'arn:aws:states:eu-central-1:123456789012:stateMachine:submission-forwarder-orchestrator';
const PERIOD = { from: '2026-08-27', to: '2026-08-28' };
const MONITOR_RUN_STARTED_AT = new Date('2026-08-28T04:00:00Z'); // 06:00 Europe/Amsterdam scheduled run, the morning after

const historiesByUuid: Record<string, unknown[]> = histories;
const executionInputsByArn: Record<string, unknown> = executionsDetail;

describe('submission processing scenario - normal day', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  const sfnMock = mockClient(SFNClient);

  beforeEach(() => {
    sfnMock.reset();
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = new URL(input.toString());
      const historyMatch = /\/objects\/([0-9a-f-]+)\/history$/.exec(url.pathname);

      if (historyMatch) {
        const results = historiesByUuid[historyMatch[1]] ?? [];
        return jsonResponse({ count: results.length, next: null, results });
      }
      if (url.pathname.endsWith('/objects')) {
        const page = url.searchParams.get('page');
        return jsonResponse(page === '1' ? objectsPage1 : objectsPage2);
      }
      throw new Error(`Test error: unexpected fetch call to ${url.toString()}`);
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test('checks a normal day with new/updated objects, multiple indexes, reference repetition, all ESF statuses and processing failures', async () => {
    const rules = new ObjectProcessingRules([
      { name: 'submission', uuid: SUBMISSION_TYPE_UUID },
      { name: 'esftaak', uuid: ESF_TYPE_UUID },
    ]);
    const objectsClient = new ObjectsApiClient({ baseUrl: 'https://mijn-services.example.nl/objects/api/v2', apiKey: 'test-token' });
    const objectRecordReader = new ObjectRecordReader(objectsClient, rules);
    const records = await objectRecordReader.findRecordsInPeriod(PERIOD);

    sfnMock.on(ListExecutionsCommand).resolves({
      executions: executionsList.map(e => ({
        ...e,
        status: e.status as ExecutionStatus,
        stateMachineArn: STATE_MACHINE_ARN,
        startDate: new Date(e.startDate),
      })),
    });
    sfnMock.on(DescribeExecutionCommand).callsFake((input) => {
      const details = executionInputsByArn[input.executionArn];
      return { input: details ? JSON.stringify(details) : undefined };
    });
    const executionReader = new SubmissionExecutionReader(STATE_MACHINE_ARN);
    const executions = await executionReader.listExecutionsWithMetadata(PERIOD, MONITOR_RUN_STARTED_AT);

    const results = checkProcessing(records, executions);

    expect([...results].sort((a, b) => a.objectUuid.localeCompare(b.objectUuid))).toEqual(expectedResults);

    // Regular (non-ESF) records: 5 expect processing, 3 succeeded, 2 problems (FAILED + MISSING).
    const regularResults = results.filter(r => !r.esfStatus);
    expect(regularResults).toHaveLength(5);
    expect(regularResults.filter(r => r.status === 'SUCCEEDED')).toHaveLength(3);
    expect(regularResults.filter(r => r.status !== 'SUCCEEDED')).toHaveLength(2);

    // ESF status counters come from the full record set, not just the processing results:
    // open/verwerkt/gesloten don't expect processing and produce no result of their own.
    const esfRecords = records.filter(r => r.esfStatus);
    expect(esfRecords.map(r => r.esfStatus).sort()).toEqual(['afgerond', 'gesloten', 'open', 'verwerkt']);

    const esfResults = results.filter(r => r.esfStatus);
    expect(esfResults).toHaveLength(1);
    expect(esfResults[0]).toMatchObject({ esfStatus: 'afgerond', status: 'SUCCEEDED' });
  });
});

describe('submission processing scenario - ambiguous day', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  const sfnMock = mockClient(SFNClient);

  const ambiguousHistoriesByUuid: Record<string, unknown[]> = ambiguousHistories;
  const ambiguousExecutionInputsByArn: Record<string, unknown> = ambiguousExecutionsDetail;

  beforeEach(() => {
    sfnMock.reset();
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = new URL(input.toString());
      const historyMatch = /\/objects\/([0-9a-f-]+)\/history$/.exec(url.pathname);

      if (historyMatch) {
        const results = ambiguousHistoriesByUuid[historyMatch[1]] ?? [];
        return jsonResponse({ count: results.length, next: null, results });
      }
      if (url.pathname.endsWith('/objects')) {
        return jsonResponse(ambiguousObjects);
      }
      throw new Error(`Test error: unexpected fetch call to ${url.toString()}`);
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test('does not guess when multiple object records cannot be safely matched to executions', async () => {
    const rules = new ObjectProcessingRules([
      { name: 'submission', uuid: SUBMISSION_TYPE_UUID },
      { name: 'esftaak', uuid: ESF_TYPE_UUID },
    ]);
    const objectsClient = new ObjectsApiClient({ baseUrl: 'https://mijn-services.example.nl/objects/api/v2', apiKey: 'test-token' });
    const objectRecordReader = new ObjectRecordReader(objectsClient, rules);
    const records = await objectRecordReader.findRecordsInPeriod(PERIOD);

    sfnMock.on(ListExecutionsCommand).resolves({
      executions: ambiguousExecutionsList.map(e => ({
        ...e,
        status: e.status as ExecutionStatus,
        stateMachineArn: STATE_MACHINE_ARN,
        startDate: new Date(e.startDate),
      })),
    });
    sfnMock.on(DescribeExecutionCommand).callsFake((input) => {
      const details = ambiguousExecutionInputsByArn[input.executionArn];
      return { input: details ? JSON.stringify(details) : undefined };
    });
    const executionReader = new SubmissionExecutionReader(STATE_MACHINE_ARN);
    const executions = await executionReader.listExecutionsWithMetadata(PERIOD, MONITOR_RUN_STARTED_AT);

    const results = checkProcessing(records, executions);

    expect([...results].sort((a, b) => `${a.objectUuid}#${a.objectIndex}`.localeCompare(`${b.objectUuid}#${b.objectIndex}`))).toEqual(ambiguousExpectedResults);

    // Object M: two indexes both expecting processing in the same period, one execution found for
    // its UUID - can't tell which index it belongs to, so both indexes become AMBIGUOUS.
    const objectMResults = results.filter(r => r.objectUuid === '11111111-0000-0000-0000-000000000101');
    expect(objectMResults).toHaveLength(2);
    expect(objectMResults.every(r => r.status === 'AMBIGUOUS' && r.matchType === 'AMBIGUOUS' && !r.executionArn)).toBe(true);

    // Object N: a single expected index, but two executions found for its UUID - can't tell which
    // one applies, so no execution ARN is guessed onto the record.
    const objectNResults = results.filter(r => r.objectUuid === '22222222-0000-0000-0000-000000000102');
    expect(objectNResults).toEqual([expect.objectContaining({ status: 'AMBIGUOUS', matchType: 'AMBIGUOUS', executionArn: undefined })]);

    // Object P is unambiguous and still resolves normally: reference and index alone don't drive
    // AMBIGUOUS, only an unreliable UUID-to-execution correlation does.
    const objectPResults = results.filter(r => r.objectUuid === '33333333-0000-0000-0000-000000000103');
    expect(objectPResults).toEqual([expect.objectContaining({ status: 'SUCCEEDED', matchType: 'UNIQUE' })]);

    // Reference, UUID and index stay available on every ambiguous result for management/recovery.
    for (const result of [...objectMResults, ...objectNResults]) {
      expect(result.reference).toBeDefined();
      expect(result.objectUuid).toBeDefined();
      expect(result.objectIndex).toBeDefined();
    }
  });
});

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}
