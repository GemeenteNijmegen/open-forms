import { LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { PrefillEndpointBase, PrefillEndpointProps } from '../PrefillEndpointBase';
import { StandplaatsvergunningFunction } from './standplaatsvergunning-function';

/**
 * Standplaatsvergunning prefill endpoint
 * Docs: docs/prefill/standplaatsvergunning/README.md
 */
export class PrefillEndpoint extends PrefillEndpointBase {
  constructor(scope: Construct, id: string, props: PrefillEndpointProps) {
    super(scope, id, props);

    const handler = new StandplaatsvergunningFunction(this, 'function', {
    });

    props.key.grantEncryptDecrypt(handler);
    props.resource.addMethod('GET', new LambdaIntegration(handler));
  }
}
