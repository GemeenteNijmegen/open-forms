import { LambdaIntegration, Resource } from 'aws-cdk-lib/aws-apigateway';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { ForwarderFunction } from './lambda/forwarder-function';

interface SubmissionForwarderOptions {
  /**
   * The API Gateway resource to create the
   * endpoint(s) in.
   */
  resource: Resource;
  /**
   * KMS key used for encrypting the logs
   */
  key: IKey;
}

/**
 * Infrastructure for forwarding the OpenForms submissions
 * to the Gemeente Nijmegen ESB.
 */
export class SubmissionForwarder extends Construct {
  private readonly apikey: Secret;
  constructor(scope: Construct, id: string, private readonly options: SubmissionForwarderOptions) {
    super(scope, id);

    this.apikey = this.setupApiKeySecret();
    this.setupLambda();
  }

  private setupApiKeySecret() {
    return new Secret(this, 'api-key', {
      description: 'API Key for authentication in submission forwarder',
      generateSecretString: {
        excludePunctuation: true,
      },
    });
  }
  private setupLambda() {
    const logs = new LogGroup(this, 'logs', {
      encryptionKey: this.options.key,
      retention: RetentionDays.SIX_MONTHS,
    });

    const forwarder = new ForwarderFunction(this, 'forwarder', {
      logGroup: logs,
      environment: {
        API_KEY_ARN: this.apikey.secretArn
      }
    });
    this.apikey.grantRead(forwarder);

    this.options.key.grantEncryptDecrypt(forwarder);
    this.options.resource.addMethod('POST', new LambdaIntegration(forwarder));
  }
}