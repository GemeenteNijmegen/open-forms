import { Criticality } from '@gemeentenijmegen/aws-constructs';
import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Key } from 'aws-cdk-lib/aws-kms';
import { SubmissionForwarder } from '../SubmissionForwarder';

function synth() {
  const app = new App();
  const stack = new Stack(app, 'TestStack');
  const key = new Key(stack, 'key');
  const api = new RestApi(stack, 'api');
  const resource = api.root.addResource('submission-forwarder');

  new SubmissionForwarder(stack, 'submission-forwarder', {
    key,
    resources: [resource],
    criticality: new Criticality('low'),
    useVipJzProductionMapping: false,
  });

  return Template.fromStack(stack);
}

describe('SubmissionForwarder — ESF processing', () => {
  const template = synth();

  function esfProcessingLogicalId() {
    const functions = template.findResources('AWS::Lambda::Function', {
      Properties: { Description: 'ESF processing lambda' },
    });
    const ids = Object.keys(functions);
    expect(ids).toHaveLength(1);
    return ids[0];
  }

  test('creates the ESF processing lambda with the submissions bucket name', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Description: 'ESF processing lambda',
      Environment: {
        Variables: Match.objectLike({
          SUBMISSION_BUCKET_NAME: Match.anyValue(),
        }),
      },
    });
  });

  test('the orchestrator can invoke the ESF processing lambda', () => {
    const lambdaId = esfProcessingLogicalId();
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'lambda:InvokeFunction',
            Resource: Match.arrayWith([{ 'Fn::GetAtt': [lambdaId, 'Arn'] }]),
          }),
        ]),
      },
    });
  });

  test('the ESF processing lambda can write to the submissions bucket', () => {
    const lambdaId = esfProcessingLogicalId();
    const role = template.findResources('AWS::Lambda::Function')[lambdaId].Properties.Role['Fn::GetAtt'][0];
    template.hasResourceProperties('AWS::IAM::Policy', {
      Roles: [{ Ref: role }],
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['s3:PutObject']),
          }),
        ]),
      },
    });
  });
});
