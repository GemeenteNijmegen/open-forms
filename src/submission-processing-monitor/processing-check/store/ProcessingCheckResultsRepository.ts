import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { SubmissionProcessingHistory } from './SubmissionProcessingHistory';
import { RunReport } from '../report/RunReport';

const TTL_IN_SECONDS = 3 * 365 * 24 * 60 * 60; // 3 years

/**
 * Reads and writes the results of the processing check: the processing history of each submission and the report of each run.
 *
 * @example
 * const resultsRepository = new ProcessingCheckResultsRepository({ tableName: process.env.TABLE_NAME! });
 * const existingHistory = await resultsRepository.getSubmissionHistory(objectUuid);
 * await resultsRepository.putSubmissionHistory(historyAfterCheckingDay({ existingHistory, day, versionOutcomes, checkedAt, runId }));
 */
export class ProcessingCheckResultsRepository {
  private readonly tableName: string;
  private readonly dynamoDb: DynamoDBClient;

  constructor(options: { tableName: string }) {
    this.tableName = options.tableName;
    this.dynamoDb = new DynamoDBClient();
  }

  async getSubmissionHistory(objectUuid: string): Promise<SubmissionProcessingHistory | undefined> {
    const result = await this.dynamoDb.send(new GetItemCommand({
      TableName: this.tableName,
      Key: marshall(historyKey(objectUuid)),
      ConsistentRead: true,
    }));
    if (!result.Item) {
      return undefined;
    }
    const item = unmarshall(result.Item);
    delete item.PK;
    delete item.SK;
    delete item.ttl;
    return item as SubmissionProcessingHistory;
  }

  /**
   * The histories of several submissions, like the notOkObjectUuids of a run report.
   *
   * In: ['3f6c2a9e-...', '8c42b9e0-...'].
   * Out: the history of each, in the same order. An objectUuid without a history is left out.
   */
  async getSubmissionHistories(objectUuids: string[]): Promise<SubmissionProcessingHistory[]> {
    const histories = await Promise.all(objectUuids.map((objectUuid) => this.getSubmissionHistory(objectUuid)));
    return histories.filter((history) => history !== undefined);
  }

  // Replaces the whole item, so a field that is missing in history is removed.
  async putSubmissionHistory(history: SubmissionProcessingHistory): Promise<void> {
    await this.putItem({ ...historyKey(history.objectUuid), ...history, ttl: ttlFrom(history.lastCheckedAt) });
  }

  // Replaces the earlier report of the same run.
  async putReport(report: RunReport): Promise<void> {
    await this.putItem({ PK: 'RUN', SK: `${report.startedAt}#${report.runId}`, ...report, ttl: ttlFrom(report.startedAt) });
  }

  private async putItem(item: Record<string, unknown>) {
    await this.dynamoDb.send(new PutItemCommand({ TableName: this.tableName, Item: marshall(item, { removeUndefinedValues: true }) }));
  }
}

function historyKey(objectUuid: string) {
  return { PK: `OBJECT#${objectUuid}`, SK: 'OBJECT' };
}

function ttlFrom(isoTime: string) {
  return Math.floor(Date.parse(isoTime) / 1000) + TTL_IN_SECONDS;
}
