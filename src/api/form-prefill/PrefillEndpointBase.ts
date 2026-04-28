import { IResource } from 'aws-cdk-lib/aws-apigateway';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface PrefillEndpointProps {
  key: Key;
  resource: IResource;
}

export abstract class PrefillEndpointBase extends Construct {
  constructor(scope: Construct, id: string, readonly props: PrefillEndpointProps) {
    super(scope, id);
  }
}
