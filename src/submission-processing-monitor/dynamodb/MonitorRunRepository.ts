import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { MonitorRun } from '../model/MonitorRun';

const TTL_RETENTION_SECONDS = 90 * 24 * 60 * 60; // 90 days

/** Writes the one compact summary item for a MonitorRun. A run is written once, when it's done - no partial updates. */
export class MonitorRunRepository {
  private readonly client: DynamoDBDocumentClient;

  constructor(private readonly tableName: string, client: DynamoDBClient = new DynamoDBClient()) {
    this.client = DynamoDBDocumentClient.from(client);
  }

  async save(run: MonitorRun): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + TTL_RETENTION_SECONDS;
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...run, ttl },
    }));
  }
}
