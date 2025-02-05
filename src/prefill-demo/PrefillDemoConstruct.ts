import { Duration } from 'aws-cdk-lib';
import { LambdaIntegration, Resource } from 'aws-cdk-lib/aws-apigateway';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { HandlerFunction } from './handler-function';
import { LogGroup } from 'aws-cdk-lib/aws-logs';

interface prefillDemoProps {
  resource: Resource;
  key: Key;
}

export class PrefillDemo extends Construct {

  private readonly props: prefillDemoProps;

  constructor(scope: Construct, id: string, props: prefillDemoProps) {
    super(scope, id);

    this.props = props;

    const apiKey = new Secret(this, 'api-key', {
      description: 'API key for prefill service',
      generateSecretString: {
        excludePunctuation: true,
      },
    });

    const logGroup = new LogGroup(this, 'logs', {
      encryptionKey: this.props.key,
    });

    const prefillFunction = new HandlerFunction(this, 'prefill', {
      description: 'Request specific claims from the and cache results',
      timeout: Duration.seconds(5),
      environment: {
        API_KEY_ARN: apiKey.secretArn,
      },
      logGroup: logGroup,
    });

    apiKey.grantRead(prefillFunction);
    props.key.grantEncryptDecrypt(prefillFunction);

    this.props.resource.addMethod('GET', new LambdaIntegration(prefillFunction));

  }

}