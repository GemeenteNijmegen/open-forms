import { RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { IGrantable } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface MonitorRunsTableProps {
  key: IKey;
}

/** Compact per-run summaries, one item per MonitorRun. No staging, no GSIs. */
export class MonitorRunsTable extends Construct {
  private readonly table: Table;

  constructor(scope: Construct, id: string, props: MonitorRunsTableProps) {
    super(scope, id);
    this.table = new Table(this, 'monitor-runs-table', {
      partitionKey: { name: 'runId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      encryptionKey: props.key,
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }

  get tableName(): string {
    return this.table.tableName;
  }

  grantReadWriteData(grantee: IGrantable): void {
    this.table.grantReadWriteData(grantee);
  }
}
