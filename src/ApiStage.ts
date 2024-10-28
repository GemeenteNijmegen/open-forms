import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { NlWalletStack } from './NlWalletStack';

interface OpenFormsStageProps extends StageProps, Configurable {}

export class OpenFormsStageStage extends Stage {

  constructor(scope: Construct, id: string, props: OpenFormsStageProps) {
    super(scope, id, props);
    Aspects.of(this).add(new PermissionsBoundaryAspect());

    if (props.configuration.nlWalletConfiguration) {
      new NlWalletStack(this, 'nl-wallet-stack', {
        env: props.configuration.deploymentEnvironment,
        configuration: props.configuration,
      });
    }

  }

}