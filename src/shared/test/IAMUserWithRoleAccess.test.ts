import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { IamUserWithRoleAccess } from '../IAMUserWithRoleAccess';

describe('IamUserWithRoleAccess – multiple instances', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');

    new IamUserWithRoleAccess(stack, 'eerste-iamuser-with-role', {
      userIdentifier: 'eerste',
      description: 'Eerste user role custom description',
    });

    new IamUserWithRoleAccess(stack, 'tweede-iamuser-with-role', {
      userIdentifier: 'tweede',
      // no description, defaults used
    });

    template = Template.fromStack(stack);
  });

  it('creates the eerste user and resources', () => {
    template.hasResourceProperties('AWS::IAM::User', {
      UserName: 'eerste-user',
    });
    template.hasResource('AWS::IAM::AccessKey', {});
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'eerste-access-key',
    });
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'eerste-role',
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Principal: { AWS: Match.anyValue() },
          }),
        ]),
      }),
    });
  });

  it('creates the tweede user and resources', () => {
    template.hasResourceProperties('AWS::IAM::User', {
      UserName: 'tweede-user',
    });
    template.hasResource('AWS::IAM::AccessKey', {});
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'tweede-access-key',
    });
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'tweede-role',
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Principal: { AWS: Match.anyValue() },
          }),
        ]),
      }),
    });
  });

  it('includes correct descriptions for secret and role', () => {
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Description: 'Secret access key for IAM user eerste-user',
    });

    template.hasResourceProperties('AWS::IAM::Role', {
      Description: 'Eerste user role custom description',
    });

    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Description: 'Secret access key for IAM user tweede-user',
    });

    template.hasResourceProperties('AWS::IAM::Role', {
      Description: 'Assumable role for IAM user tweede-user',
    });
  });

  it('creates two unique AccessKey resources', () => {
    template.resourceCountIs('AWS::IAM::AccessKey', 2);
  });
});
