import { RemovalPolicy } from 'aws-cdk-lib';
import { LambdaIntegration, Resource } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { PrefillFunction } from './prefill/prefill-function';
import { TokenFunction } from './token/token-function';

interface TokenCacheServcieProps {
  resource: Resource;
  key?: Key;
  debug?: boolean;
  tokenEndpoint: string;
}

export class TokenCacheService extends Construct {

  private readonly props: TokenCacheServcieProps;

  constructor(scope: Construct, id: string, props: TokenCacheServcieProps) {
    super(scope, id);

    this.props = props;
    const table = this.cacheTable();

    const token = this.props.resource.addResource('token');
    const prefill = this.props.resource.addResource('prefill');

    const apiKey = new Secret(this, 'api-key', {
      description: 'API key for prefill service',
      generateSecretString: {
        excludePunctuation: true,
      },
    });

    const tokenFunction = new TokenFunction(this, 'token', {
      description: 'Passthrough to token endpoint and cache results',
      environment: {
        TABLE_NAME: table.tableName,
        DEBUG: props.debug ? 'true' : 'false',
        TOKEN_ENDPOINT: props.tokenEndpoint,
      },
    });

    const prefillFunction = new PrefillFunction(this, 'prefill', {
      description: 'Request specific claims from the and cache results',
      environment: {
        TABLE_NAME: table.tableName,
        API_KEY_ARN: apiKey.secretArn,
        DEBUG: props.debug ? 'true' : 'false',
      },
    });

    apiKey.grantRead(prefillFunction);
    table.grantReadData(prefillFunction);
    table.grantWriteData(tokenFunction);
    if (props.key) {
      props.key.grantEncryptDecrypt(tokenFunction);
      props.key.grantEncryptDecrypt(prefillFunction);
    }

    token.addMethod('POST', new LambdaIntegration(tokenFunction));
    prefill.addMethod('GET', new LambdaIntegration(prefillFunction));


  }

  private cacheTable() {
    return new Table(this, 'cache-table', {
      partitionKey: { name: 'sub', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.RETAIN,
      encryptionKey: this.props.key,
    });
  }

}