// ~~ Generated by projen. To modify, edit .projenrc.ts and run "npx projen".
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * Props for TokenFunction
 */
export interface TokenFunctionProps extends lambda.FunctionOptions {
}

/**
 * An AWS Lambda function which executes src/nl-wallet/token/token.
 */
export class TokenFunction extends lambda.Function {
  constructor(scope: Construct, id: string, props?: TokenFunctionProps) {
    super(scope, id, {
      description: 'src/nl-wallet/token/token.lambda.ts',
      ...props,
      runtime: new lambda.Runtime('nodejs22.x', lambda.RuntimeFamily.NODEJS),
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../assets/nl-wallet/token/token.lambda')),
    });
    this.addEnvironment('AWS_NODEJS_CONNECTION_REUSE_ENABLED', '1', { removeInEdge: true });
  }
}