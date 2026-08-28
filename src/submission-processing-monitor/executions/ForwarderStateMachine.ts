import { Arn, ArnFormat, Stack } from 'aws-cdk-lib';
import { Grant, IGrantable } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { IStateMachine, StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';

export interface ForwarderStateMachineProps {
  stateMachineArn: string;
  /** KMS key the forwarder's state machine execution data is encrypted with. */
  key: IKey;
}

/** Read-only reference to the existing submission-forwarder Step Function. */
export class ForwarderStateMachine extends Construct {
  private readonly stateMachine: IStateMachine;
  private readonly key: IKey;

  constructor(scope: Construct, id: string, props: ForwarderStateMachineProps) {
    super(scope, id);
    this.stateMachine = StateMachine.fromStateMachineArn(this, 'state-machine', props.stateMachineArn);
    this.key = props.key;
  }

  /** Narrower than StateMachine.grantRead(): no GetExecutionHistory, no "*"-scoped actions. */
  grantReadExecutions(grantee: IGrantable): void {
    const executionArn = Stack.of(this).formatArn({
      service: 'states',
      resource: 'execution',
      resourceName: Arn.split(this.stateMachine.stateMachineArn, ArnFormat.COLON_RESOURCE_NAME).resourceName,
      arnFormat: ArnFormat.COLON_RESOURCE_NAME,
    });

    Grant.addToPrincipal({
      grantee,
      actions: ['states:ListExecutions'],
      resourceArns: [this.stateMachine.stateMachineArn],
    });
    Grant.addToPrincipal({
      grantee,
      actions: ['states:DescribeExecution'],
      resourceArns: [`${executionArn}:*`],
    });
    this.key.grantDecrypt(grantee);
  }
}
