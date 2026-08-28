import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { getEnvironmentConfiguration } from '../../Configuration';
import { SubmissionProcessingMonitor } from '../SubmissionProcessingMonitor';

function synth(): Template {
  const app = new App();
  const stack = new Stack(app, 'TestStack');
  const key = new Key(stack, 'key');

  new SubmissionProcessingMonitor(stack, 'submission-processing-monitor', {
    configuration: getEnvironmentConfiguration('acceptance'),
    key,
  });

  return Template.fromStack(stack);
}

describe('SubmissionProcessingMonitor infrastructure', () => {
  const template = synth();
  const templateJson = JSON.stringify(template.toJSON());

  /** The monitor Lambda's own logical id - there's only one AWS::Lambda::Function in this stack. */
  function monitorFunctionLogicalId(): string {
    return Object.keys(template.findResources('AWS::Lambda::Function'))[0];
  }

  /** The Scheduler DLQ's own logical id - there's only one AWS::SQS::Queue in this stack. */
  function schedulerDlqLogicalId(): string {
    return Object.keys(template.findResources('AWS::SQS::Queue'))[0];
  }

  test('creates one EventBridge Scheduler that invokes the monitor Lambda daily at 06:00 Europe/Amsterdam', () => {
    template.resourceCountIs('AWS::Scheduler::Schedule', 1);
    template.hasResourceProperties('AWS::Scheduler::Schedule', {
      ScheduleExpression: 'cron(0 6 * * ? *)',
      ScheduleExpressionTimezone: 'Europe/Amsterdam',
      FlexibleTimeWindow: { Mode: 'OFF' },
      Target: Match.objectLike({
        Arn: { 'Fn::GetAtt': [monitorFunctionLogicalId(), 'Arn'] },
        Input: '{"mode":"PREVIOUS_DAY"}',
      }),
    });
  });

  test('the monitor Lambda has a 15 minute timeout', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Timeout: 900,
    });
  });

  test('the Scheduler has its own dead-letter queue, referenced by the schedule target', () => {
    template.resourceCountIs('AWS::SQS::Queue', 1);
    template.hasResourceProperties('AWS::Scheduler::Schedule', {
      Target: Match.objectLike({
        DeadLetterConfig: { Arn: { 'Fn::GetAtt': [schedulerDlqLogicalId(), 'Arn'] } },
      }),
    });
  });

  test('creates exactly two DynamoDB tables (MonitorRuns and ProcessingIssues)', () => {
    template.resourceCountIs('AWS::DynamoDB::Table', 2);
  });

  test('the Scheduler is allowed to invoke the monitor Lambda', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'sts:AssumeRole',
            Principal: { Service: 'scheduler.amazonaws.com' },
          }),
        ]),
      },
    });
    expect(templateJson).toContain('lambda:InvokeFunction');
  });

  test('the monitor may read the existing submission-forwarder Step Function, never start/stop/redrive it', () => {
    expect(templateJson).toContain('states:ListExecutions');
    expect(templateJson).toContain('states:DescribeExecution');
    expect(templateJson).not.toContain('states:StartExecution');
    expect(templateJson).not.toContain('states:StopExecution');
    expect(templateJson).not.toContain('states:RedriveExecution');
  });
});
