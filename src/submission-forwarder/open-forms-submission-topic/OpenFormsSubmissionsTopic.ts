import { Criticality, DeadLetterQueue } from '@gemeentenijmegen/aws-constructs';
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Topic, LoggingConfig, LoggingProtocol, SubscriptionProtocol } from 'aws-cdk-lib/aws-sns';
import { UrlSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface OpenFormsTopicProps {
  /**
   * Required: Encryption key for messages.
   */
  kmsKey: IKey;
  /**
   * Optional: Set a lower criticality (default critical)
   */
  criticality?: Criticality;
  /** External endpoint URLs for SNS deliveries */
  endpointUrls: string[];
}

export class OpenFormsSubmissionsTopic extends Construct {
  public topic: Topic;
  public dlq: Queue;

  constructor(scope: Construct, id: string, props: OpenFormsTopicProps) {
    super(scope, id);

    this.topic = new Topic(this, 'Topic', {
      displayName: 'OpenForms Submissions Topic',
      masterKey: props.kmsKey,
    });
    const loggingConfig = this.createLoggingConfig();
    this.topic.addLoggingConfig(loggingConfig as LoggingConfig);

    const dlqSetup = new DeadLetterQueue(
      this,
      'open-forms-submission-topic-dlq',
      {
        alarmDescription: 'Open Forms Submission Topic DLQ not empty',
        alarmCriticality: props.criticality,
        kmsKey: props.kmsKey,
      },
    );
    this.dlq = dlqSetup.dlq;


    // Cloudformation seems to have issues with this setup for now
    props.endpointUrls.forEach((url) => {
      const subscription = this.topic.addSubscription(
        new UrlSubscription(url, {
          deadLetterQueue: this.dlq,
          protocol: SubscriptionProtocol.HTTPS,
          // No filterpolicy set right now, only one subscription and one type pushed to topic
        }),
      );

      subscription.node.addDependency(this.dlq);
    });
  }

  private createLoggingConfig(): LoggingConfig {
    const deliveryLogGroup = new LogGroup(
      this,
      'sns-submissiontopic-delivery-status-loggroup',
      {
        retention: RetentionDays.SIX_MONTHS,
        // No kms encryption because only the messageId is traceable and visible
      },
    );


    const loggingRole = new Role(this, 'sns-submission-delivery-status-role', {
      assumedBy: new ServicePrincipal('sns.amazonaws.com'),
    });
    loggingRole.addToPolicy(
      new PolicyStatement({
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [
          deliveryLogGroup.logGroupArn,
          `${deliveryLogGroup.logGroupArn}:*`,
        ],
      }),
    );

    const config: LoggingConfig = {
      protocol: LoggingProtocol.HTTP,
      failureFeedbackRole: loggingRole,
      successFeedbackRole: loggingRole,
      successFeedbackSampleRate: 100,
    };

    return config;
  }
}
