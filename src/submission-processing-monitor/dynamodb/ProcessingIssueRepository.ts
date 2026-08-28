import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ProcessingResult } from '../model/ProcessingResult';

const TTL_RETENTION_SECONDS = 90 * 24 * 60 * 60; // 90 days

export interface ProcessingIssueContext {
  runId: string;
  checkedAt: Date;
}

/**
 * Upserts and resolves ProcessingIssues, keyed on objectUuid + objectIndex. Every write goes
 * through DynamoDB's own conditional expressions rather than a read-then-write round trip:
 * firstDetectedAt survives repeated detections via if_not_exists, and resolving only touches an
 * issue that already exists via attribute_exists - a successful record never creates a new issue.
 */
export class ProcessingIssueRepository {
  private readonly client: DynamoDBDocumentClient;

  constructor(private readonly tableName: string, client: DynamoDBClient = new DynamoDBClient()) {
    this.client = DynamoDBDocumentClient.from(client);
  }

  /** Creates or refreshes an open issue for a record that isn't reliably SUCCEEDED. */
  async recordProblem(result: ProcessingResult, context: ProcessingIssueContext): Promise<void> {
    const lastCheckedAt = context.checkedAt.toISOString();
    const { expression, names, values } = buildSetExpression({
      objectUuid: result.objectUuid,
      objectIndex: result.objectIndex,
      objectType: result.objectType,
      registrationAt: result.registrationAt,
      reference: result.reference,
      clientNumber: result.clientNumber,
      esfStatus: result.esfStatus,
      processingStatus: result.status,
      recoveryStatus: 'OPEN',
      matchType: result.matchType,
      executionArn: result.executionArn,
      lastCheckedAt,
      lastRunId: context.runId,
      ttl: Math.floor(context.checkedAt.getTime() / 1000) + TTL_RETENTION_SECONDS,
    });

    await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: issueKey(result.objectUuid, result.objectIndex),
      UpdateExpression: `${expression}, firstDetectedAt = if_not_exists(firstDetectedAt, :lastCheckedAt)`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }));
  }

  /**
   * Marks an existing issue resolved after a later reliable check shows the record succeeded.
   * A no-op when there was no open issue for this record.
   */
  async recordResolved(result: ProcessingResult, context: ProcessingIssueContext): Promise<void> {
    const lastCheckedAt = context.checkedAt.toISOString();
    const { expression, names, values } = buildSetExpression({
      processingStatus: result.status,
      recoveryStatus: 'RESOLVED',
      lastCheckedAt,
      lastRunId: context.runId,
      resolvedAt: lastCheckedAt,
      successfulExecutionArn: result.executionArn,
      ttl: Math.floor(context.checkedAt.getTime() / 1000) + TTL_RETENTION_SECONDS,
    });

    try {
      await this.client.send(new UpdateCommand({
        TableName: this.tableName,
        Key: issueKey(result.objectUuid, result.objectIndex),
        UpdateExpression: expression,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: 'attribute_exists(PK)',
      }));
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return;
      }
      throw error;
    }
  }
}

function issueKey(objectUuid: string, objectIndex: number): { PK: string; SK: string } {
  return { PK: `OBJECT#${objectUuid}`, SK: `INDEX#${String(objectIndex).padStart(6, '0')}` };
}

function buildSetExpression(fields: Record<string, unknown>): { expression: string; names: Record<string, string>; values: Record<string, unknown> } {
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const assignments: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }
    names[`#${key}`] = key;
    values[`:${key}`] = value;
    assignments.push(`#${key} = :${key}`);
  }
  return { expression: `SET ${assignments.join(', ')}`, names, values };
}
