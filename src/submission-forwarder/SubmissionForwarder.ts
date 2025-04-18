import { Criticality, DeadLetterQueue, ErrorMonitoringAlarm } from '@gemeentenijmegen/aws-constructs';
import { Duration, Stack } from 'aws-cdk-lib';
import { LambdaIntegration, Resource } from 'aws-cdk-lib/aws-apigateway';
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
import { Construct } from 'constructs';
import { Statics } from '../Statics';
import { BackupFunction } from './backup-lambda/backup-function';
import { ForwarderFunction } from './forwarder-lambda/forwarder-function';
import { InternalNotificationMailFunction } from './internal-notification-mail-lambda/internalNotificationMail-function';
import { ReceiverFunction } from './receiver-lambda/receiver-function';

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

    this.traceTable = this.setupTraceTable();
    this.esbQueue = this.setupEsbQueue();
    this.parameters = this.setupParameters();
    this.bucket = this.setupSubmissionsBucket();
    this.topic = this.setupInternalTopic();

    this.setupEsbUser();
    this.setupLambda();
    this.setupBackupLambda();
    this.setupNotificationMailLambda();
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

  private setupLambda() {
    if (!this.parameters) {
      throw Error('Parameters should be created first');
    }

    // Setup a internal queue
    const internalQueue = this.setupInternalQueue();

    // Create a receiver lambda (listens to the endpoint and publishes to internal queue)
    const receiver = new ReceiverFunction(this, 'receiver', {
      logGroup: new LogGroup(this, 'receiver-logs', {
        encryptionKey: this.options.key,
        retention: RetentionDays.SIX_MONTHS,
      }),
      timeout: Duration.seconds(3),
      description: 'Submission-forwarder receiver endpoint',
      environment: {
        POWERTOOLS_LOG_LEVEL: this.options.logLevel ?? 'DEBUG',
        API_KEY_ARN: this.parameters.apikey.secretArn,
        TOPIC_ARN: this.topic.topicArn,
        MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM: this.parameters.mijnServicesOpenZaakApiClientId.parameterName,
        MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN: this.parameters.mijnServicesOpenZaakApiClientSecret.secretArn,
        OBJECTS_API_APIKEY_ARN: this.parameters.objectsApikey.secretArn,
      },
    });
    internalQueue.grantSendMessages(receiver);
    this.parameters.apikey.grantRead(receiver);
    this.options.key.grantEncryptDecrypt(receiver);
    this.options.resource.addMethod('POST', new LambdaIntegration(receiver));
    this.topic.grantPublish(receiver);
    this.parameters.objectsApikey.grantRead(receiver);
    this.parameters.mijnServicesOpenZaakApiClientId.grantRead(receiver);
    this.parameters.mijnServicesOpenZaakApiClientSecret.grantRead(receiver);

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
      },
    });

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

  private setupInternalQueue() {
    const dlq = new DeadLetterQueue(this, 'internal-dlq', {
      kmsKey: this.options.key,
      alarmDescription: 'Open Forms forwarder internal DLQ received messages',
    });

    const internalQueue = new Queue(this, 'internal-queue', {
      encryption: QueueEncryption.KMS,
      encryptionMasterKey: this.options.key,
      visibilityTimeout: Duration.minutes(10), // Note must be bigger than handler lambda timeout
      deadLetterQueue: {
        queue: dlq.dlq,
        maxReceiveCount: 3,
      },
    });
    return internalQueue;
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

    return new Topic(this, 'internal-topic', {
      enforceSSL: true,
      masterKey: this.options.key,
      loggingConfigs: [{
        protocol: LoggingProtocol.LAMBDA,
        failureFeedbackRole: logRole,
        successFeedbackRole: logRole,
      }],
    });
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

  private setupBackupLambda() {
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

    const backupLambda = new BackupFunction(this, 'backup-function', {
      description: 'Writes SNS messages to S3 bucket',
      environment: {
        BACKUP_BUCKET: backupBucket.bucketName,
      },
    });
    backupBucket.grantWrite(backupLambda);

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
        MAIL_FROM_DOMAIN: accountHostedZoneName,
        TRACE_TABLE_NAME: this.traceTable.tableName,
      },
    });
    this.traceTable.grantWriteData(internalNotificationMailLambda);
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

}
