import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';

interface OpenFormsStageProps extends StageProps, Configurable {}

export class OpenFormsStage extends Stage {

  constructor(scope: Construct, id: string, props: OpenFormsStageProps) {
    super(scope, id, props);
    Aspects.of(this).add(new PermissionsBoundaryAspect());

  }

}