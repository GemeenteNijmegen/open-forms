import { IKey } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { Configurable } from '../Configuration';
import { ForwarderStateMachine } from './executions/ForwarderStateMachine';
import { MonitorConfiguration } from './MonitorConfiguration';

export interface SubmissionProcessingMonitorProps extends Configurable {
  /** Shared KMS key, also used by SubmissionForwarder's state machine execution data. */
  key: IKey;
}

export class SubmissionProcessingMonitor extends Construct {
  public readonly configuration: MonitorConfiguration;
  public readonly forwarderStateMachine: ForwarderStateMachine;

  constructor(scope: Construct, id: string, private readonly props: SubmissionProcessingMonitorProps) {
    super(scope, id);
    this.configuration = new MonitorConfiguration(this, 'configuration');
    this.forwarderStateMachine = new ForwarderStateMachine(this, 'forwarder-state-machine', {
      stateMachineArn: this.configuration.submissionForwarderStateMachineArn.stringValue,
      key: props.key,
    });
  }
}
