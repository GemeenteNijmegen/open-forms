import { Criticality } from '@gemeentenijmegen/aws-constructs';
import { Duration } from 'aws-cdk-lib';
import { Alarm, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { FilterPattern, ILogGroup, MetricFilter } from 'aws-cdk-lib/aws-logs';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface MonitorAlarmsProps {
  monitorFunction: IFunction;
  monitorLogGroup: ILogGroup;
  schedulerDeadLetterQueue: IQueue;
  criticality: Criticality;
}

/**
 * Technical monitor failures versus functional ProcessingIssues are two different things: a
 * COMPLETED run with problems is not an AWS failure and never trips these alarms. Alarm names
 * carry the criticality suffix for pickup by the landingzone monitoring, same as ErrorMonitoringAlarm.
 */
export class MonitorAlarms extends Construct {
  constructor(scope: Construct, id: string, props: MonitorAlarmsProps) {
    super(scope, id);
    const suffix = props.criticality.alarmSuffix();

    new Alarm(this, 'errors', {
      alarmName: `submission-processing-monitor-errors${suffix}`,
      alarmDescription: 'The nightly submission-processing-monitor run reported a Lambda error.',
      metric: props.monitorFunction.metric('Errors', { statistic: 'sum', period: Duration.hours(1) }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    new Alarm(this, 'duration', {
      alarmName: `submission-processing-monitor-duration${suffix}`,
      alarmDescription: 'The nightly submission-processing-monitor run is approaching its 15 minute timeout.',
      metric: props.monitorFunction.metricDuration({ statistic: 'maximum', period: Duration.hours(1) }),
      threshold: Duration.minutes(13).toMilliseconds(),
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    new Alarm(this, 'scheduler-dlq', {
      alarmName: `submission-processing-monitor-scheduler-dlq${suffix}`,
      alarmDescription: 'The Scheduler could not invoke the submission-processing-monitor Lambda.',
      metric: props.schedulerDeadLetterQueue.metricApproximateNumberOfMessagesOutstanding({ statistic: 'maximum', period: Duration.hours(1) }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    const incompleteRunsMetric = new MetricFilter(this, 'incomplete-runs-filter', {
      logGroup: props.monitorLogGroup,
      metricNamespace: 'SubmissionProcessingMonitor',
      metricName: 'MonitorIncomplete',
      filterPattern: FilterPattern.all(
        FilterPattern.stringValue('$.message', '=', 'Monitor run finished'),
        FilterPattern.stringValue('$.status', '=', 'INCOMPLETE'),
      ),
      metricValue: '1',
    });

    new Alarm(this, 'incomplete', {
      alarmName: `submission-processing-monitor-incomplete${suffix}`,
      alarmDescription: 'A submission-processing-monitor run stopped before both scans finished (runtime limit reached).',
      metric: incompleteRunsMetric.metric({ statistic: 'sum', period: Duration.hours(1) }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
  }
}
