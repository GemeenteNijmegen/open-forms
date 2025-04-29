import { Criticality, DeadLetterQueue, ErrorMonitoringAlarm } from '@gemeentenijmegen/aws-constructs';
import { Duration, Stack } from 'aws-cdk-lib';
import { LambdaIntegration, Resource } from 'aws-cdk-lib/aws-apigateway';
import { ComparisonOperator, Stats, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { AccessKey, Effect, PolicyStatement, Role, ServicePrincipal, User } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { SnsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { LoggingProtocol, SubscriptionFilter, Topic } from 'aws-cdk-lib/aws-sns';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { CustomerManagedEncryptionConfiguration, DefinitionBody, LogLevel, StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { Statics } from '../Statics';
import { BackupFunction } from './backup-lambda/backup-function';
import { ForwarderFunction } from './forwarder-lambda/forwarder-function';
import { InternalNotificationMailFunction } from './internal-notification-mail-lambda/internalNotificationMail-function';
import { ReceiverFunction } from './receiver-lambda/receiver-function';
import { ResubmitFunction } from './resubmit-lambda/resubmit-function';

interface SubmissionForwarderOptions {
  /**
   * The API Gateway resource to create the
   * endpoint(s) in.
   */
  resource: Resource;
  /**
   * KMS key used for encrypting the logs
   */
  key: IKey;
  /**
   * Log level
   * @default DEBUG
   */
  logLevel?: string;
  /**
   * Criticality
   */
  criticality: Criticality;
}

/**
 * Infrastructure for forwarding the OpenForms submissions
 * to the Gemeente Nijmegen ESB.
 */
export class SubmissionForwarder extends Construct {
  private readonly esbQueue: Queue;
  private esbDeadLetterQueue?: Queue;
  private readonly bucket: Bucket;
  private readonly topic: Topic;
  private readonly traceTable: Table;
  private readonly backupBucket: Bucket;
  private readonly parameters?: {
    apikey: Secret;
    objectsApikey: Secret;
    documentenApiBaseUrl: StringParameter;
    zakenApiBaseUrl: StringParameter;
    catalogiApiBaseUrl: StringParameter;
    mijnServicesOpenZaakApiClientId: StringParameter;
    mijnServicesOpenZaakApiClientSecret: Secret;
  };
  constructor(scope: Construct, id: string, private readonly options: SubmissionForwarderOptions) {
    super(scope, id);

    this.backupBucket = this.setupBackupBucket();
    this.traceTable = this.setupTraceTable();
    this.esbQueue = this.setupEsbQueue();
    this.parameters = this.setupParameters();
    this.bucket = this.setupSubmissionsBucket();
    this.topic = this.setupInternalTopic();

    this.setupEsbUser();
    this.setupReceiverLambda();
    this.setupEsbForwarderLambda();
    this.setupBackupLambda();
    this.setupNotificationMailLambda();
    this.setupResubmitLambda();

    this.setupOrchestrationStepFunction();
  }

  private setupParameters() {
    const baseParameterName = '/open-forms/submissionforwarder/';
    // To be deleted for rename
    new Secret(this, 'documentenApiClientSecret', {
      description: 'Client secret used by submission-forwarder to authenticate at documenten API',
    });

    new StringParameter(this, 'documentenApiClientId', {
      stringValue: 'submission-forwarder',
      description: 'Client ID used by submission-forwarder to authenticate at documenten API',
    });


    const apikey = new Secret(this, 'api-key', {
      description: 'API Key for authentication in submission forwarder',
      generateSecretString: {
        excludePunctuation: true,
      },
    });

    const objectsApikey = new Secret(this, 'objects-apikey', {
      description: 'API key used by submission forwarder for authentication at Objects API',
    });

    const documentenApiBaseUrl = new StringParameter(this, 'documentenApiBaseUrl', {
      stringValue: '-',
      description: 'Base URL used by submission-forwarder to reach the documenten API',
    });
    const zakenApiBaseUrl = new StringParameter(this, 'zakenApiBaseUrl', {
      parameterName: `${baseParameterName}zaken-api-base-url`,
      stringValue: '-',
      description: 'Base URL used by submission-forwarder to reach the zaken API',
    });
    const catalogiApiBaseUrl = new StringParameter(this, 'catalogiApiBaseUrl', {
      parameterName: `${baseParameterName}catalogi-api-base-url`,
      stringValue: '-',
      description: 'Base URL used by submission-forwarder to reach the catalogi API',
    });

    const mijnServicesOpenZaakApiClientId = new StringParameter(this, 'mijnServicesOpenZaakApiClientId', {
      parameterName: `${baseParameterName}mijn-services-open-zaak/client-id`,
      stringValue: 'submission-forwarder',
      description: 'Client ID used by submission-forwarder to authenticate at mijn services open zaak APIs',
    });

    const mijnServicesOpenZaakApiClientSecret = new Secret(this, 'mijnServicesOpenZaakApiClientSecret', {
      secretName: `${baseParameterName}mijn-services-open-zaak/client-secret`,
      description: 'Client secret used by submission-forwarder to authenticate at mijn services open zaak APIs',
    });

    return {
      apikey,
      objectsApikey,
      documentenApiBaseUrl,
      zakenApiBaseUrl,
      catalogiApiBaseUrl,
      mijnServicesOpenZaakApiClientId,
      mijnServicesOpenZaakApiClientSecret,
    };
  }

  private setupReceiverLambda() {
    if (!this.parameters) {
      throw Error('Parameters should be created first');
    }

    // Create a receiver lambda (listens to the endpoint and publishes to internal queue)
    const receiver = new ReceiverFunction(this, 'receiver', {
      logGroup: new LogGroup(this, 'receiver-logs', {
        encryptionKey: this.options.key,
        retention: RetentionDays.SIX_MONTHS,
      }),
      timeout: Duration.seconds(6),
      description: 'Submission-forwarder receiver endpoint',
      environment: {
        POWERTOOLS_LOG_LEVEL: this.options.logLevel ?? 'DEBUG',
        API_KEY_ARN: this.parameters.apikey.secretArn,
        TOPIC_ARN: this.topic.topicArn,
        MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM: this.parameters.mijnServicesOpenZaakApiClientId.parameterName,
        MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN: this.parameters.mijnServicesOpenZaakApiClientSecret.secretArn,
        OBJECTS_API_APIKEY_ARN: this.parameters.objectsApikey.secretArn,
        TRACE_TABLE_NAME: this.traceTable.tableName,
      },
    });
    this.traceTable.grantWriteData(receiver);
    this.parameters.apikey.grantRead(receiver);
    this.options.key.grantEncryptDecrypt(receiver);
    this.options.resource.addMethod('POST', new LambdaIntegration(receiver));
    this.topic.grantPublish(receiver);
    this.parameters.objectsApikey.grantRead(receiver);
    this.parameters.mijnServicesOpenZaakApiClientId.grantRead(receiver);
    this.parameters.mijnServicesOpenZaakApiClientSecret.grantRead(receiver);
  }

  private setupEsbForwarderLambda() {
    if (!this.parameters) {
      throw Error('Parameters should be created first');
    }

    // Create a forwarder lambda (listens to the internal queue)
    const forwarder = new ForwarderFunction(this, 'forwarder', {
      logGroup: new LogGroup(this, 'logs', {
        encryptionKey: this.options.key,
        retention: RetentionDays.SIX_MONTHS,
      }),
      description: 'Submission-forwarder forwaring to ESB lambda',
      timeout: Duration.minutes(5), // Allow to run for a long time as we need to download/upload multiple documents
      environment: {
        POWERTOOLS_LOG_LEVEL: this.options.logLevel ?? 'DEBUG',

        // Provided directly trough env.
        SUBMISSION_BUCKET_NAME: this.bucket.bucketName,
        DOCUMENTEN_BASE_URL: this.parameters.documentenApiBaseUrl.stringValue,
        ZAKEN_BASE_URL: this.parameters.zakenApiBaseUrl.stringValue,
        CATALOGI_BASE_URL: this.parameters.catalogiApiBaseUrl.stringValue,

        // Loaded dynamically
        OBJECTS_API_APIKEY_ARN: this.parameters.objectsApikey.secretArn,
        MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM: this.parameters.mijnServicesOpenZaakApiClientId.parameterName,
        MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN: this.parameters.mijnServicesOpenZaakApiClientSecret.secretArn,
        QUEUE_URL: this.esbQueue.queueUrl,
        TRACE_TABLE_NAME: this.traceTable.tableName,
      },
    });

    this.traceTable.grantWriteData(forwarder);
    this.bucket.grantPut(forwarder);
    this.esbQueue.grantSendMessages(forwarder);
    this.parameters.objectsApikey.grantRead(forwarder);
    this.parameters.mijnServicesOpenZaakApiClientId.grantRead(forwarder);
    this.parameters.mijnServicesOpenZaakApiClientSecret.grantRead(forwarder);
    this.options.key.grantEncryptDecrypt(forwarder);

    forwarder.addEventSource(new SnsEventSource(this.topic, {
      filterPolicy: {
        networkShare: SubscriptionFilter.stringFilter({ allowlist: ['true'] }),
      },
    }));

    new ErrorMonitoringAlarm(this, 'alarm', {
      criticality: new Criticality('high'),
      lambda: forwarder,
    });
  }

  private setupOrchestrationStepFunction() {

    const logGroup = new LogGroup(this, 'orchestrator-logs', {
      encryptionKey: this.options.key,
    });

    const stepfunction = new StateMachine(this, 'orchestrator', {
      comment: 'Orchestrates handling of the open-forms submissions',
      tracingEnabled: true,
      definitionBody: DefinitionBody.fromFile('src/submission-forwarder/orchestration.json'),
      definitionSubstitutions: {
        'BACKUP_BUCKET_NAME': this.backupBucket.bucketName,
      },
      encryptionConfiguration: new CustomerManagedEncryptionConfiguration(this.options.key),
      logs: {
        destination: logGroup,
        level: LogLevel.ALL,
      }
    });

    return stepfunction;
  }

  private setupInternalTopic() {
    const region = Stack.of(this).region;
    const account = Stack.of(this).account;
    const logRole = new Role(this, 'log-role', {
      assumedBy: new ServicePrincipal('sns.amazonaws.com'),
      description: 'Role for logging submission delivery status',
    });

    logRole.addToPrincipalPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: [
        `arn:aws:logs:${region}:${account}:*`,
      ],
    }));
    this.options.key.grantEncrypt(logRole);

    const topic = new Topic(this, 'internal-topic', {
      enforceSSL: true,
      masterKey: this.options.key,
      loggingConfigs: [{
        protocol: LoggingProtocol.LAMBDA,
        failureFeedbackRole: logRole,
        successFeedbackRole: logRole,
      }],
    });

    topic.metricNumberOfNotificationsFailed({
      period: Duration.minutes(5),
      statistic: Stats.SUM,
    }).createAlarm(this, 'topic-failed-alarm', {
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmName: 'submission-forwarder-delivery-failed-alarm' + this.options.criticality.alarmSuffix(),
    });

    return topic;
  }

  private setupEsbQueue() {
    const dlq = new DeadLetterQueue(this, 'esb-dead-letter-queue', {
      alarmDescription: 'ESB Dead letter queue not empty',
      alarmCriticality: this.options.criticality.increase(), // Bump by one
      queueOptions: {
        fifo: true,
      },
      kmsKey: this.options.key,
    });

    this.esbDeadLetterQueue = dlq.dlq;

    return new Queue(this, 'esb-queue', {
      fifo: true,
      encryption: QueueEncryption.KMS,
      encryptionMasterKey: this.options.key,
      deadLetterQueue: {
        queue: dlq.dlq,
        maxReceiveCount: 3,
      },
    });
  }

  private setupSubmissionsBucket() {
    return new Bucket(this, 'submissions-bucket', {
      encryptionKey: this.options.key,
      bucketKeyEnabled: true, // Save cost
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });
  }

  private setupEsbUser() {
    const user = new User(this, 'esb-user');
    const credentials = new AccessKey(this, 'esb-credentials', { user });
    new Secret(this, 'esb-credentials-secret', {
      secretStringValue: credentials.secretAccessKey,
      description: 'Secret access key for ESB user',
    });

    const role = new Role(this, 'esb-role', {
      assumedBy: user,
      description: 'Role to assume for ESB user',
    });

    this.esbDeadLetterQueue?.grantSendMessages(role); // ESB publishes messages on DLQ on failure
    this.esbQueue.grantConsumeMessages(role);
    this.bucket.grantRead(role);
    this.options.key.grantDecrypt(role);
  }

  private setupBackupBucket() {
    const backupBucket = new Bucket(this, 'submissions-backup-bucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryptionKey: this.options.key,
      bucketKeyEnabled: true, // Saves KSM costs
      lifecycleRules: [
        {
          enabled: true,
          expiration: Duration.days(90),
        },
      ],
    });
    return backupBucket;
  }

  private setupBackupLambda() {
    const backupLambda = new BackupFunction(this, 'backup-function', {
      description: 'Writes SNS messages to S3 bucket',
      environment: {
        POWERTOOLS_LOG_LEVEL: this.options.logLevel ?? 'DEBUG',
        BACKUP_BUCKET: this.backupBucket.bucketName,
        TRACE_TABLE_NAME: this.traceTable.tableName,
      },
    });
    this.traceTable.grantWriteData(backupLambda);
    this.backupBucket.grantWrite(backupLambda);

    backupLambda.addEventSource(new SnsEventSource(this.topic, {
      filterPolicy: {
        resubmit: SubscriptionFilter.stringFilter({ denylist: ['true'] }), // Exclude resubmissions
      },
    }));
  }

  private setupNotificationMailLambda() {
    const accountHostedZoneName = StringParameter.valueForStringParameter(this, Statics.accountRootHostedZoneName);
    const internalNotificationMailLambda = new InternalNotificationMailFunction(this, 'internal-notification-function', {
      description: 'Sends internal notification emails',
      environment: {
        POWERTOOLS_LOG_LEVEL: this.options.logLevel ?? 'DEBUG',
        MAIL_FROM_DOMAIN: accountHostedZoneName,
        TRACE_TABLE_NAME: this.traceTable.tableName,
      },
    });
    this.traceTable.grantWriteData(internalNotificationMailLambda);
    internalNotificationMailLambda.addToRolePolicy(new PolicyStatement({
      resources: ['*'],
      actions: [
        'ses:SendEmail',
        'ses:SendRawEmail',
      ],
    }));
    internalNotificationMailLambda.addEventSource(new SnsEventSource(this.topic, {
      filterPolicy: {
        internalNotificationEmails: SubscriptionFilter.stringFilter({ allowlist: ['true'] }),
      },
    }));

  }

  private setupTraceTable() {
    return new Table(this, 'trace-table', {
      partitionKey: { // in the format: <reference>#<handler> so e.g. OF-1234#BACKUP or OF-1234#NOTIFICATION_MAIL
        name: 'trace',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      encryptionKey: this.options.key,
    });
  }

  private setupResubmitLambda() {
    const apikey = new Secret(this, 'resubmit-api-key', {
      description: 'API key for calling the resubmit endpoint',
      generateSecretString: {
        excludePunctuation: true,
      },
    });

    const resubmitLambda = new ResubmitFunction(this, 'resubmit', {
      description: 'Retry failed submissions by resubmitting',
      environment: {
        BACKUP_BUCKET: this.backupBucket.bucketName,
        API_KEY: apikey.secretArn,
        TOPIC_ARN: this.topic.topicArn,
      },
    });
    this.topic.grantPublish(resubmitLambda);
    apikey.grantRead(resubmitLambda);
    this.bucket.grantRead(resubmitLambda);

    // Setup API gateway path
    const resource = this.options.resource.addResource('resubmit');
    resource.addMethod('POST', new LambdaIntegration(resubmitLambda));

  }

}
