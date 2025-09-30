import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { OpenFormsSubmissionsTopic } from '../OpenFormsSubmissionsTopic';

describe('OpenFormsSubmissionsTopic', () => {
  let stack: Stack;
  let template: Template;
  const urls = [
    {
      appId: 'VIP',
      url: 'https://nepvip.com/subscriber',
    },
    {
      appId: 'JUR',
      url: 'https://nepjz.com/subscriber',
    },
  ];

  beforeAll(() => {
    stack = new Stack();
    new OpenFormsSubmissionsTopic(stack, 'TestTopic', {
      kmsKey: new Key(stack, 'TestKey'),
      urlSubscriptions: urls,
    });
    template = Template.fromStack(stack);
  });

  it('creates an HTTPS subscription for each endpoint URL', () => {
    template.resourceCountIs('AWS::SNS::Subscription', urls.length);
    urls.forEach((url) => {
      template.hasResourceProperties('AWS::SNS::Subscription', {
        Protocol: 'https',
        Endpoint: url.url,
      });
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
