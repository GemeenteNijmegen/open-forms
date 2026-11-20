import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { scenario as cloudwatchFout } from './samples/cloudwatch-fout';
import { scenario as esfTaakOverTweeDagen } from './samples/esf-taak-over-twee-dagen';
import { scenario as hercontroleMetCloudwatchFout } from './samples/hercontrole-met-cloudwatch-fout';
import { scenario as hercontroleNaRedrive } from './samples/hercontrole-na-redrive';
import { scenario as objectsApiFout } from './samples/objects-api-fout';
import { scenario as ophalenMisluktZonderOfNummer } from './samples/ophalen-mislukt-zonder-of-nummer';
import { RunScenario } from './samples/RunScenario';
import { scenario as tijdOpHalverwege } from './samples/tijd-op-halverwege';
import { ObjectReader } from '../../object-reader/ObjectReader';
import { CloudWatchSubmissionLogReader } from '../../submission-log-reader/CloudWatchSubmissionLogReader';
import { SubmissionLogUuidsResult } from '../../submission-log-reader/SubmissionLogReaderTypes';
import { ProcessingCheck, ProcessingCheckEvent } from '../ProcessingCheck';
import { ProcessingCheckResultsRepository } from '../store/ProcessingCheckResultsRepository';

// One scenario per file in samples/. A new sample file needs an import and an entry here.
const scenarios = [
  cloudwatchFout,
  esfTaakOverTweeDagen,
  hercontroleMetCloudwatchFout,
  hercontroleNaRedrive,
  objectsApiFout,
  ophalenMisluktZonderOfNummer,
  tijdOpHalverwege,
];

// The table in memory, by PK|SK.
const table = new Map<string, Record<string, unknown>>();
const dynamoDb = mockClient(DynamoDBClient);

beforeEach(() => {
  table.clear();
  dynamoDb.reset();
  dynamoDb.on(GetItemCommand).callsFake((input) => {
    const key = unmarshall(input.Key);
    const item = table.get(`${key.PK}|${key.SK}`);
    return { Item: item ? marshall(item) : undefined };
  });
  dynamoDb.on(PutItemCommand).callsFake((input) => {
    const item = unmarshall(input.Item);
    table.set(`${item.PK}|${item.SK}`, item);
    return {};
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function prepareReaders(scenario: RunScenario) {
  jest.spyOn(ObjectReader.prototype, 'findVersions').mockImplementation(async (period) => {
    if (scenario.objectsApiFails) {
      throw new Error('Objects API returned 500');
    }
    const days = Object.keys(scenario.objectReaderVersionsPerDay).filter((day) => day >= period!.firstDay && day <= period!.lastDay);
    return days.flatMap((day) => scenario.objectReaderVersionsPerDay[day]);
  });
  // Reads the objects in order and checks shouldStop before each one, like the reader does before each group.
  jest.spyOn(CloudWatchSubmissionLogReader.prototype, 'findByObjectUuids').mockImplementation(async (options) => {
    const reads: SubmissionLogUuidsResult = { logs: [], failedReads: [], diagnostics: [], stopped: false };
    for (const objectUuid of options.objectUuids) {
      if (options.shouldStop()) {
        reads.stopped = true;
        return reads;
      }
      if (scenario.logReadFailsFor.includes(objectUuid)) {
        reads.failedReads.push({ objectUuid, error: new Error('CloudWatch query failed') });
        continue;
      }
      const logs = scenario.logReaderResults.find((result) => result.lookup.objectUuid === objectUuid);
      if (!logs) {
        throw new Error(`The scenario has no logs for ${objectUuid}`);
      }
      reads.logs.push(logs);
    }
    return reads;
  });
}

function runCheck(event: ProcessingCheckEvent, remainingTimeInMillis: number[]) {
  let call = 0;
  const check = new ProcessingCheck({ resultsRepository: new ProcessingCheckResultsRepository({ tableName: 'results' }), diagnostics: false });
  return check.run({
    event,
    runId: 'run-1',
    getRemainingTimeInMillis: () => remainingTimeInMillis[Math.min(call++, remainingTimeInMillis.length - 1)],
  });
}

describe('ProcessingCheck scenarios in test/samples', () => {
  test.each(scenarios)('$description', async (scenario) => {
    for (const history of scenario.historiesBefore) {
      table.set(`OBJECT#${history.objectUuid}|OBJECT`, { PK: `OBJECT#${history.objectUuid}`, SK: 'OBJECT', ...history });
    }
    prepareReaders(scenario);

    const report = await runCheck(scenario.event, scenario.remainingTimeInMillis);

    const histories = [...table.values()]
      .filter((item) => item.SK === 'OBJECT')
      .sort((a, b) => String(a.objectUuid).localeCompare(String(b.objectUuid)));
    expect(report).toMatchObject(scenario.expected.report);
    expect(histories).toMatchObject(scenario.expected.histories);
    expect(histories).toHaveLength(scenario.expected.histories.length);
  });

  test.each([
    { firstDay: '2026-11-18' },
    { firstDay: '2026-02-30', lastDay: '2026-03-01' },
    { firstDay: '2026-11-19', lastDay: '2026-11-18' },
    { firstDay: '2025-01-01', lastDay: '2026-11-18' },
  ])('een fout event %j geeft een fout en schrijft niets in de tabel', async (event) => {
    await expect(runCheck(event, [600_000])).rejects.toThrow();
    expect(table.size).toBe(0);
  });
});
