import { Criticality, ErrorMonitoringAlarm } from '@gemeentenijmegen/aws-constructs';
import { CfnOutput, Duration, Stack } from 'aws-cdk-lib';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
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
  logLevel: string;
  criticality: Criticality;
}

export class ProcessingCheckLambda extends Construct {
  constructor(scope: Construct, id: string, props: ProcessingCheckLambdaProps) {
    super(scope, id);

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
      environment: {
        POWERTOOLS_LOG_LEVEL: props.logLevel,
        TABLE_NAME: props.resultsTable.tableName,
        DIAGNOSTICS: String(props.diagnostics),
      },
    });

    props.resultsTable.grantReadWriteData(processingCheck);
    props.key.grantDecrypt(processingCheck);
    StringParameter.fromStringParameterName(this, 'objects-api-base-url', Statics.ssmSubmissionProcessingMonitorObjectsApiBaseUrl)
      .grantRead(processingCheck);
    StringParameter.fromStringParameterName(this, 'object-types', Statics.ssmObjectTypes).grantRead(processingCheck);
    Secret.fromSecretNameV2(this, 'objects-api-token', Statics.secretSubmissionProcessingMonitorObjectsApiToken).grantRead(processingCheck);

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

    new ErrorMonitoringAlarm(this, 'error-alarm', {
      criticality: props.criticality,
      lambda: processingCheck,
    });

    new CfnOutput(this, 'function-name', {
      description: 'Start the processing check from the Lambda console with this function',
      value: processingCheck.functionName,
    });
  }
}
