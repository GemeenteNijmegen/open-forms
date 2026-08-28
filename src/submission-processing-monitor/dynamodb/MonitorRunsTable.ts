import { RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { IGrantable } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/** Compact per-run summaries, one item per MonitorRun. No staging, no GSIs. */
export class MonitorRunsTable extends Construct {
  private readonly table: Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.table = new Table(this, 'monitor-runs-table', {
      partitionKey: { name: 'runId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }

  get tableName(): string {
    return this.table.tableName;
  }

  /** Narrower than Table.grantReadWriteData(): MonitorRunRepository only ever writes a run once, via PutItem. */
  grantWrite(grantee: IGrantable): void {
    this.table.grant(grantee, 'dynamodb:PutItem');
  }
}
