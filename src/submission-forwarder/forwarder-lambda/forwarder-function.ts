// ~~ Generated by projen. To modify, edit .projenrc.ts and run "npx projen".
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * Props for ForwarderFunction
 */
export interface ForwarderFunctionProps extends lambda.FunctionOptions {
}

/**
 * An AWS Lambda function which executes src/submission-forwarder/forwarder-lambda/forwarder.
 */
export class ForwarderFunction extends lambda.Function {
  constructor(scope: Construct, id: string, props?: ForwarderFunctionProps) {
    super(scope, id, {
      description: 'src/submission-forwarder/forwarder-lambda/forwarder.lambda.ts',
      ...props,
      runtime: new lambda.Runtime('nodejs20.x', lambda.RuntimeFamily.NODEJS),
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../assets/submission-forwarder/forwarder-lambda/forwarder.lambda')),
    });
    this.addEnvironment('AWS_NODEJS_CONNECTION_REUSE_ENABLED', '1', { removeInEdge: true });
  }
}