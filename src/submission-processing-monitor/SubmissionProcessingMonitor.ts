import { Duration } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Configurable } from '../Configuration';
import { Statics } from '../Statics';
import { MonitorRunsTable } from './dynamodb/MonitorRunsTable';
import { ProcessingIssuesTable } from './dynamodb/ProcessingIssuesTable';
import { ForwarderStateMachine } from './executions/ForwarderStateMachine';
import { MonitorFunction } from './monitor-lambda/monitor-function';
import { MonitorConfiguration } from './MonitorConfiguration';

export interface SubmissionProcessingMonitorProps extends Configurable {
  /** Shared KMS key, also used by SubmissionForwarder's state machine execution data. */
  key: IKey;
}

export class SubmissionProcessingMonitor extends Construct {
  public readonly configuration: MonitorConfiguration;
  public readonly forwarderStateMachine: ForwarderStateMachine;
  public readonly monitorRunsTable: MonitorRunsTable;
  public readonly processingIssuesTable: ProcessingIssuesTable;
  public readonly monitorFunction: IFunction;

  constructor(scope: Construct, id: string, private readonly props: SubmissionProcessingMonitorProps) {
    super(scope, id);
    this.configuration = new MonitorConfiguration(this, 'configuration');
    this.forwarderStateMachine = new ForwarderStateMachine(this, 'forwarder-state-machine', {
      stateMachineArn: this.configuration.submissionForwarderStateMachineArn.stringValue,
      key: props.key,
    });
    // With tables for the UI connection later on and maybe retries of notifications.
    this.monitorRunsTable = new MonitorRunsTable(this, 'monitor-runs-table', { key: props.key });
    this.processingIssuesTable = new ProcessingIssuesTable(this, 'processing-issues-table', { key: props.key });
    this.monitorFunction = this.setupMonitorLambda();
  }

  private setupMonitorLambda(): IFunction {
    const accountHostedZoneName = StringParameter.valueForStringParameter(this, Statics.accountRootHostedZoneName);

    const monitorFunction = new MonitorFunction(this, 'monitor', {
      description: 'Nightly submission-processing-monitor run',
      timeout: Duration.minutes(15),
      memorySize: 512,
      logGroup: new LogGroup(this, 'monitor-logs', {
        encryptionKey: this.props.key,
        retention: RetentionDays.SIX_MONTHS,
      }),
      environment: {
        POWERTOOLS_LOG_LEVEL: this.props.configuration.logLevel ?? 'INFO',
        OBJECTS_API_BASE_URL: this.configuration.objectsApiBaseUrl.stringValue,
        OBJECTS_API_TOKEN_ARN: this.configuration.objectsApiToken.secretArn,
        OBJECT_TYPES: this.configuration.objectTypes.stringValue,
        STATE_MACHINE_ARN: this.configuration.submissionForwarderStateMachineArn.stringValue,
        MONITOR_RUNS_TABLE_NAME: this.monitorRunsTable.tableName,
        PROCESSING_ISSUES_TABLE_NAME: this.processingIssuesTable.tableName,
        REPORT_RECIPIENTS: this.configuration.reportRecipients.stringValue,
        ESF_REPORT_RECIPIENTS: this.configuration.esfReportRecipients.stringValue,
        REPORT_FROM_ADDRESS: `submission-processing-monitor@${accountHostedZoneName}`,
        REPORT_ENABLED: String(this.props.configuration.submissionProcessingMonitorReportEnabled ?? true),
      },
    });

    this.configuration.objectsApiToken.grantRead(monitorFunction);
    this.forwarderStateMachine.grantReadExecutions(monitorFunction);
    this.monitorRunsTable.grantWrite(monitorFunction);
    this.processingIssuesTable.grantUpdate(monitorFunction);
    monitorFunction.addToRolePolicy(new PolicyStatement({
      resources: ['*'],
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    }));

    return monitorFunction;
  }
}
