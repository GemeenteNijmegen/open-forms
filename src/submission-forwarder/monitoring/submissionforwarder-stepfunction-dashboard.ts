import { Duration } from 'aws-cdk-lib';
import { Dashboard, GraphWidget } from 'aws-cdk-lib/aws-cloudwatch';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';


interface SubmissionForwarderStepFunctionDashboardOptions {
  /**
   * The ARN of the step function state machine to make the dashboard from
   */
  stateMachineArn: string;
}
export class SubmissionForwarderStepFunctionDashboard extends Construct {
  constructor(scope: Construct, id: string, private readonly options: SubmissionForwarderStepFunctionDashboardOptions) {
    super(scope, id);

    const stateMachine = StateMachine.fromStateMachineArn(this, 'statemachine-for-dashboard', this.options.stateMachineArn);
    const execStarted = stateMachine.metric('ExecutionsStarted', { statistic: 'Sum' });
    const execFailed = stateMachine.metric('ExecutionsFailed', { statistic: 'Sum' });
    const execSucc = stateMachine.metric('ExecutionsSucceeded', { statistic: 'Sum' });

    const dashboard = new Dashboard(this, 'SMSFDashboard', {
      dashboardName: 'SubmissionForwarderStepFunctionOverview',
      defaultInterval: Duration.days(7),
    });

    dashboard.addWidgets(
      new GraphWidget({
        title: 'Executions per Hour',
        left: [execStarted.with({ period: Duration.hours(1), label: 'Started/hour' })],
      }),
      new GraphWidget({
        title: 'Executions per Day',
        left: [execStarted.with({ period: Duration.days(1), label: 'Started/day' })],
      }),
      new GraphWidget({
        title: 'Success vs Failure (hourly)',
        left: [execSucc.with({ period: Duration.hours(1), label: 'Succeeded' })],
        right: [execFailed.with({ period: Duration.hours(1), label: 'Failed' })],
      }),
    );
  }
}
