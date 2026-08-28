import { RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { IGrantable } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface ProcessingIssuesTableProps {
  key: IKey;
}

/**
 * Durable ProcessingIssue records, keyed on PK = OBJECT#<uuid>, SK = INDEX#<zero-padded-index>.
 * No GSIs: the monitor always knows objectUuid + objectIndex when it reads or writes an issue.
 */
export class ProcessingIssuesTable extends Construct {
  private readonly table: Table;

  constructor(scope: Construct, id: string, props: ProcessingIssuesTableProps) {
    super(scope, id);
    this.table = new Table(this, 'processing-issues-table', {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      encryptionKey: props.key,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }

  get tableName(): string {
    return this.table.tableName;
  }

  /** Narrower than Table.grantReadWriteData(): ProcessingIssueRepository only ever writes via UpdateItem, its conditional checks run server-side inside that call. */
  grantUpdate(grantee: IGrantable): void {
    this.table.grant(grantee, 'dynamodb:UpdateItem');
  }
}
