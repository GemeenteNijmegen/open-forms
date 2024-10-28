import { RemovalPolicy } from 'aws-cdk-lib';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { PrefillFunction } from './prefill/prefill-function';
import { TokenFunction } from './token/token-function';

interface TokenCacheServcieProps {
  api: RestApi;
  key?: Key;
}

export class TokenCacheService extends Construct {

  private readonly props: TokenCacheServcieProps;

  constructor(scope: Construct, id: string, props: TokenCacheServcieProps) {
    super(scope, id);

    this.props = props;
    const table = this.cacheTable();

    const tokenCache = props.api.root.addResource('token-cache');
    const token = tokenCache.addResource('token');
    const prefill = tokenCache.addResource('prefill');

    const tokenFunction = new TokenFunction(this, 'token', {
      description: 'Passthrough to token endpoint and cache results',
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    const prefillFunction = new PrefillFunction(this, 'prefill', {
      description: 'Request specific claims from the and cache results',
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

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