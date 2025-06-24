import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Stack, Tags, Stage, StageProps, Aspects } from 'aws-cdk-lib';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './Statics';

export interface ParameterStageProps extends StageProps, Configurable {}

/**
 * Stage for creating SSM parameters. This needs to run
 * before stages that use them.
 */
export class ParameterStage extends Stage {
  constructor(scope: Construct, id: string, props: ParameterStageProps) {
    super(scope, id, props);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);
    Aspects.of(this).add(new PermissionsBoundaryAspect());
    new ParameterStack(this, 'stack');
  }
}

/**
 * Stack that creates ssm parameters for the application.
 * These need to be present before stacks that use them.
 */
export class ParameterStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);

    this.addDummyParameters();
    this.addSnsSubscriptionUrlParameters();
  }

  private addDummyParameters() {
    new StringParameter(this, 'dummy-parameter', {
      stringValue: '-',
      parameterName: Statics.ssmDummyParameter,
    });
  }

  private addSnsSubscriptionUrlParameters() {
    new StringParameter(this, 'ssm-sns-url-subscription-vip-1', {
      parameterName: Statics.ssmSNSSubscriptionUrlVIP,
      stringValue: '-',
      description: 'SNS Topic Subscription URL for VIP Woweb',
    });
    new StringParameter(this, 'ssm-sns-url-subscription-jz4all-1', {
      parameterName: Statics.ssmSNSSubscriptionUrlJZ4ALL,
      stringValue: '-',
      description: 'SNS Topic Subscription URL for JZ4ALL Woweb',
    });
  }
}
