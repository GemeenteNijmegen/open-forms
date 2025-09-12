import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { StaticFormDefinitionsFunction } from './lambda/StaticFormDefinitions-function';

export interface StaticFormDefinitionsProps {
  logLevel: string;
  api: RestApi;
}

export class StaticFormDefinitions extends Construct {
  constructor(scope: Construct, id: string, private props: StaticFormDefinitionsProps) {
    super(scope, id);

    const bucket = new Bucket(this, 'bucket', {
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    const endpoint = new StaticFormDefinitionsFunction(this, 'endpoint', {
      description: 'Serves static form definitions',
      environment: {
        POWERTOOLS_LOG_LEVEL: this.props.logLevel ?? 'INFO',
        FORM_DEF_BUCKET: bucket.bucketName,
      },
    });
    bucket.grantRead(endpoint);

    const resource = this.props.api.root.addResource('static-form-definitions');
    resource.addMethod('GET', new LambdaIntegration(endpoint));

  }
}