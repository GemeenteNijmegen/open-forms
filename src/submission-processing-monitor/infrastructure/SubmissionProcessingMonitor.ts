import { IKey } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { ProcessingCheckLambda } from './ProcessingCheckLambda';
import { ProcessingCheckResultsTable } from './ProcessingCheckResultsTable';
import { Configurable } from '../../Configuration';

export interface SubmissionProcessingMonitorProps extends Configurable {
  key: IKey;
}

export class SubmissionProcessingMonitor extends Construct {
  constructor(scope: Construct, id: string, props: SubmissionProcessingMonitorProps) {
    super(scope, id);

    const results = new ProcessingCheckResultsTable(this, 'results');

    new ProcessingCheckLambda(this, 'processing-check', {
      key: props.key,
      resultsTable: results.resultsTable,
      diagnostics: props.configuration.submissionProcessingMonitor?.diagnostics ?? false,
      logLevel: props.configuration.logLevel ?? 'INFO',
      criticality: props.configuration.criticality,
    });
  }
}
