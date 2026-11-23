import { Criticality, ErrorMonitoringAlarm } from '@gemeentenijmegen/aws-constructs';
import { Duration, Stack, TimeZone } from 'aws-cdk-lib';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Schedule, ScheduleExpression, ScheduleTargetInput } from 'aws-cdk-lib/aws-scheduler';
import { LambdaInvoke } from 'aws-cdk-lib/aws-scheduler-targets';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Statics } from '../../Statics';
import { ProcessingCheckFunction } from '../processing-check/processing-check-function';

export interface ProcessingCheckLambdaProps {
  // The key of the stack: for the own log group, and to read the receiver and orchestrator log groups, which use the same key.
  key: IKey;
  resultsTable: ITable;
  diagnostics: boolean;
  // Without it nothing runs at night; with it the check runs at 06:00 Amsterdam for yesterday and mails the reports that are true.
  dailyCheck?: { emailSubmissionReport: boolean; emailEsfReport: boolean };
  // In the subject and the header of the reports, like Productie.
  environmentName: string;
  logLevel: string;
  criticality: Criticality;
}

export class ProcessingCheckLambda extends Construct {
  constructor(scope: Construct, id: string, props: ProcessingCheckLambdaProps) {
    super(scope, id);

    // Like the internal notification mail of the forwarder, with its own name before the @.
    const accountDomain = StringParameter.valueForStringParameter(this, Statics.accountRootHostedZoneName);
    const reportFromAddress = `submission-processing-monitor@${accountDomain}`;

    const processingCheck = new ProcessingCheckFunction(this, 'function', {
      description: 'Checks for a period whether the Open Forms submissions were processed',
      logGroup: new LogGroup(this, 'logs', {
        encryptionKey: props.key,
        retention: RetentionDays.SIX_MONTHS,
      }),
      timeout: Duration.minutes(15),
      memorySize: 1024,
      // Two runs at the same time could overwrite each other's histories.
      reservedConcurrentExecutions: 1,
      // The scheduler invokes asynchronously, and Lambda retries a failed async run twice by default. A failed mail must not run the whole
      // check again; the alarm shows the failure. A run from the console is synchronous and is not affected.
      retryAttempts: 0,
      environment: {
        POWERTOOLS_LOG_LEVEL: props.logLevel,
        TABLE_NAME: props.resultsTable.tableName,
        DIAGNOSTICS: String(props.diagnostics),
        ENVIRONMENT_NAME: props.environmentName,
        REPORT_FROM_ADDRESS: reportFromAddress,
      },
    });

    props.resultsTable.grantReadWriteData(processingCheck);
    props.key.grantDecrypt(processingCheck);
    StringParameter.fromStringParameterName(this, 'objects-api-base-url', Statics.ssmSubmissionProcessingMonitorObjectsApiBaseUrl)
      .grantRead(processingCheck);
    StringParameter.fromStringParameterName(this, 'object-types', Statics.ssmObjectTypes).grantRead(processingCheck);
    Secret.fromSecretNameV2(this, 'objects-api-token', Statics.secretSubmissionProcessingMonitorObjectsApiToken).grantRead(processingCheck);
    StringParameter.fromStringParameterName(this, 'submission-report-recipients', Statics.ssmSubmissionProcessingMonitorSubmissionReportRecipients)
      .grantRead(processingCheck);
    StringParameter.fromStringParameterName(this, 'esf-report-recipients', Statics.ssmSubmissionProcessingMonitorEsfReportRecipients)
      .grantRead(processingCheck);
    // SES with the same rights as the internal notification mail.
    processingCheck.addToRolePolicy(new PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    // The queries find the receiver and orchestrator log groups by tag (SOURCE logGroupTags), so the log groups are not named here.
    const stack = Stack.of(this);
    processingCheck.addToRolePolicy(new PolicyStatement({
      actions: ['logs:StartQuery', 'logs:GetQueryResults'],
      resources: [`arn:aws:logs:${stack.region}:${stack.account}:log-group:*`],
    }));
    // StartQuery calls DescribeLogGroups for SOURCE logGroupTags, on arn:aws:logs:<region>:<account>:*:*, not on log-group:*.
    processingCheck.addToRolePolicy(new PolicyStatement({
      actions: ['logs:DescribeLogGroups'],
      resources: [`arn:aws:logs:${stack.region}:${stack.account}:*`],
    }));
    processingCheck.addToRolePolicy(new PolicyStatement({
      actions: ['logs:StopQuery'],
      resources: ['*'],
    }));

    if (props.dailyCheck) {
      new Schedule(this, 'daily-check', {
        description: 'Checks yesterday and delivers the reports of the submission processing monitor',
        schedule: ScheduleExpression.cron({ minute: '0', hour: '6', timeZone: TimeZone.of('Europe/Amsterdam') }),
        target: new LambdaInvoke(processingCheck, {
          input: ScheduleTargetInput.fromObject(props.dailyCheck),
          retryAttempts: 0,
        }),
      });
    }

    new ErrorMonitoringAlarm(this, 'error-alarm', {
      criticality: props.criticality,
      lambda: processingCheck,
    });
  }
}
