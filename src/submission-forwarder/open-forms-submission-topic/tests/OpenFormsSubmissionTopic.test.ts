import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { OpenFormsSubmissionsTopic } from '../OpenFormsSubmissionsTopic';

describe('OpenFormsSubmissionsTopic', () => {
  let stack: Stack;
  let template: Template;
  const urls = [
    'https://nepvip.com/subscriber',
    'https://nepjz.com/subscriber',
  ];

  beforeAll(() => {
    stack = new Stack();
    new OpenFormsSubmissionsTopic(stack, 'TestTopic', {
      kmsKey: new Key(stack, 'TestKey'),
      endpointUrls: urls,
    });
    template = Template.fromStack(stack);
  });

  it('creates an HTTPS subscription for each endpoint URL', () => {
    template.resourceCountIs('AWS::SNS::Subscription', urls.length);
    urls.forEach((url) => {
      template.hasResourceProperties('AWS::SNS::Subscription', {
        Protocol: 'https',
        Endpoint: url,
      });
    });
  });

  it('creates exactly one SQS DLQ with the right name and encryption key', () => {
    template.resourceCountIs('AWS::SQS::Queue', 1);
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'open-forms-submission-topic-dlq',
      KmsMasterKeyId: {
        'Fn::GetAtt': [Match.stringLikeRegexp('TestKey'), 'Arn'],
      },
    });
  });

  it('allows SNS to send messages to the DLQ', () => {
    template.hasResourceProperties('AWS::SQS::QueuePolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'sqs:SendMessage',
            Principal: { Service: 'sns.amazonaws.com' },
          }),
        ]),
      },
    });
  });

  it('grants the HTTP subscription role permission to assume the SNS-logging role', () => {
    // Still seems the best way to give the permissions, no easy new methods for topic
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'sts:AssumeRole',
            Principal: { Service: 'sns.amazonaws.com' },
          }),
        ]),
      },
    });
  });
});
