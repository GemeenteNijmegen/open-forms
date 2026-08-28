import { Construct } from 'constructs';
import { Configurable } from '../Configuration';
import { MonitorConfiguration } from './MonitorConfiguration';

export interface SubmissionProcessingMonitorProps extends Configurable {}

export class SubmissionProcessingMonitor extends Construct {
  public readonly configuration: MonitorConfiguration;

  constructor(scope: Construct, id: string, private readonly props: SubmissionProcessingMonitorProps) {
    super(scope, id);
    this.configuration = new MonitorConfiguration(this, 'configuration');
  }
}
