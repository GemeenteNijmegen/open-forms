import { Criticality } from '@gemeentenijmegen/aws-constructs';
import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Key } from 'aws-cdk-lib/aws-kms';
import { SubmissionForwarder } from '../SubmissionForwarder';

function synth(tribeDryRun: boolean) {
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
    tribeDryRun,
  });

  return Template.fromStack(stack);
}

describe('SubmissionForwarder — Tribe resources', () => {
  test('CDK synth succeeds', () => {
    expect(() => synth(true)).not.toThrow();
  });

  test('creates one AUTODELEN credentials secret with the unfilled placeholder', () => {
    const template = synth(true);
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      SecretString: Match.stringLikeRegexp('VUL_HANDMATIG_IN'),
    });
  });

  test('grants the TribeProcessor Lambda read access to exactly its own secret', () => {
    const template = synth(true);
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['secretsmanager:GetSecretValue']),
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  test('TribeProcessor Lambda has a 3 minute timeout', () => {
    const template = synth(true);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Description: 'Maps and sends Tribe submissions (Autodelen)',
      Timeout: 180,
    });
  });

  test('TRIBE_SEND_MODE is DRY_RUN when tribeDryRun is true (accp)', () => {
    const template = synth(true);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Description: 'Maps and sends Tribe submissions (Autodelen)',
      Environment: {
        Variables: Match.objectLike({ TRIBE_SEND_MODE: 'DRY_RUN' }),
      },
    });
  });

  test('TRIBE_SEND_MODE is empty when tribeDryRun is false (productie)', () => {
    const template = synth(false);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Description: 'Maps and sends Tribe submissions (Autodelen)',
      Environment: {
        Variables: Match.objectLike({ TRIBE_SEND_MODE: '' }),
      },
    });
  });

  test('the Tribe base URL and token URL are configured on the Lambda', () => {
    const template = synth(true);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Description: 'Maps and sends Tribe submissions (Autodelen)',
      Environment: {
        Variables: Match.objectLike({
          TRIBE_BASE_URL: 'https://api.tribecrm.nl/v1/odata/',
          TRIBE_TOKEN_URL: 'https://auth.tribecrm.nl/oauth2/token',
        }),
      },
    });
  });

  test('the orchestrator Step Function has a TRIBE_PROCESSOR_LAMBDA_ARN substitution', () => {
    const template = synth(true);
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      DefinitionSubstitutions: Match.objectLike({
        TRIBE_PROCESSOR_LAMBDA_ARN: Match.anyValue(),
      }),
    });
  });

  test('the orchestrator Step Function is granted invoke permission on the TribeProcessor Lambda', () => {
    const template = synth(true);
    const tribeProcessorResources = template.findResources('AWS::Lambda::Function', {
      Properties: { Description: 'Maps and sends Tribe submissions (Autodelen)' },
    });
    const tribeProcessorLogicalId = Object.keys(tribeProcessorResources)[0];
    expect(tribeProcessorLogicalId).toBeDefined();

    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'lambda:InvokeFunction',
            Effect: 'Allow',
            Resource: Match.arrayWith([
              Match.objectLike({ 'Fn::GetAtt': Match.arrayWith([tribeProcessorLogicalId]) }),
            ]),
          }),
        ]),
      },
    });
  });
});
