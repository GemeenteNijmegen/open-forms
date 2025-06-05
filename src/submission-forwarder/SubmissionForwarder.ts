import { Criticality, DeadLetterQueue, ErrorMonitoringAlarm } from '@gemeentenijmegen/aws-constructs';
import { Duration } from 'aws-cdk-lib';
import { LambdaIntegration, Resource } from 'aws-cdk-lib/aws-apigateway';
import { ComparisonOperator, Stats, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { AccessKey, Effect, PolicyStatement, Role, User } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { CustomerManagedEncryptionConfiguration, DefinitionBody, LogLevel, StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { Statics } from '../Statics';
import { DeliveryQueue } from './DeliveryQueue';
import { DocumentsToS3StorageFunction } from './documentsToS3Storage/documentsToS3Storage-function';
import { ForwarderFunction } from './forwarder-lambda/forwarder-function';
import { InternalNotificationMailFunction } from './internal-notification-mail-lambda/internalNotificationMail-function';
import { ReceiverFunction } from './receiver-lambda/receiver-function';
import { ResubmitFunction } from './resubmit-lambda/resubmit-function';
import { ZgwRegistrationFunction } from './zgw-registration-lambda/zgw-registration-function';

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
  private readonly backupBucket: Bucket;

  private readonly parameters?: {
    apikey: Secret;
    objectsApikey: Secret;
    documentenApiBaseUrl: StringParameter;
    zakenApiBaseUrl: StringParameter;
    catalogiApiBaseUrl: StringParameter;
    mijnServicesOpenZaakApiClientId: StringParameter;
    mijnServicesOpenZaakApiClientSecret: Secret;
    supportedObjectTypes: StringParameter;
  };

  constructor(scope: Construct, id: string, private readonly options: SubmissionForwarderOptions) {
    super(scope, id);

    this.backupBucket = this.setupBackupBucket();
    this.esbQueue = this.setupEsbQueue();

    this.parameters = this.setupParameters();
    this.bucket = this.setupSubmissionsBucket();

    const esbRole = this.setupEsbUser();

    const esfQueue = this.setupESF(esbRole);

    const documentStorage = this.setupDocumentStorageLambda();
    const forwarder = this.setupEsbForwarderLambda();
    const notification = this.setupNotificationMailLambda();
    const zgw = this.setupZgwRegistrationLambda();

    const orchestrator = this.setupOrchestrationStepFunction(documentStorage, forwarder, notification, zgw, esfQueue.queue);
    this.setupReceiverLambda(orchestrator);
    this.setupResubmitLambda(orchestrator);
  }

  private setupESF(esbRole: Role) {
    return new DeliveryQueue(this, 'efs-queue', {
      key: this.options.key,
      role: esbRole,
      QueueProps: {
        retentionPeriod: Duration.days(14),
      },
    });
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

    const additionalParameters = new ForwarderParameters(this, 'params');

    return {
      apikey,
      objectsApikey,
      documentenApiBaseUrl,
      zakenApiBaseUrl,
      catalogiApiBaseUrl,
      mijnServicesOpenZaakApiClientId,
      mijnServicesOpenZaakApiClientSecret,
      supportedObjectTypes: additionalParameters.supportedObjectTypes,
    };
  }

  private setupReceiverLambda(orchestrator: StateMachine) {
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
        MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM: this.parameters.mijnServicesOpenZaakApiClientId.parameterName,
        MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN: this.parameters.mijnServicesOpenZaakApiClientSecret.secretArn,
        OBJECTS_API_APIKEY_ARN: this.parameters.objectsApikey.secretArn,
        ORCHESTRATOR_ARN: orchestrator.stateMachineArn,
        SUPPORTED_OBJECTTYPES: this.parameters.supportedObjectTypes.stringValue,
      },
    });
    this.parameters.apikey.grantRead(receiver);
    this.options.key.grantEncryptDecrypt(receiver);
    this.options.resource.addMethod('POST', new LambdaIntegration(receiver));
    this.parameters.objectsApikey.grantRead(receiver);
    this.parameters.mijnServicesOpenZaakApiClientId.grantRead(receiver);
    this.parameters.mijnServicesOpenZaakApiClientSecret.grantRead(receiver);
    orchestrator.grantStartExecution(receiver);
  }

  private setupDocumentStorageLambda() {
    if (!this.parameters) {
      throw Error('Parameters should be created first');
    }

    // Create a forwarder lambda (listens to the internal queue)
    const s3StorageFunction = new DocumentsToS3StorageFunction(this, 'docsToS3', {
      memorySize: 1024,
      logGroup: new LogGroup(this, 'docstoS3logs', {
        encryptionKey: this.options.key,
        retention: RetentionDays.SIX_MONTHS,
      }),
      description: 'Submission documents to S3 lambda',
      timeout: Duration.minutes(5), // Allow to run for a long time as we need to download/upload multiple documents
      environment: {
        POWERTOOLS_LOG_LEVEL: this.options.logLevel ?? 'DEBUG',

        // Provided directly trough env.
        SUBMISSION_BUCKET_NAME: this.bucket.bucketName,
        DOCUMENTEN_BASE_URL: this.parameters.documentenApiBaseUrl.stringValue,

        // Loaded dynamically
        OBJECTS_API_APIKEY_ARN: this.parameters.objectsApikey.secretArn,
        MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM: this.parameters.mijnServicesOpenZaakApiClientId.parameterName,
        MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN: this.parameters.mijnServicesOpenZaakApiClientSecret.secretArn,
      },
    });

    this.bucket.grantPut(s3StorageFunction);
    this.parameters.objectsApikey.grantRead(s3StorageFunction);
    this.parameters.mijnServicesOpenZaakApiClientId.grantRead(s3StorageFunction);
    this.parameters.mijnServicesOpenZaakApiClientSecret.grantRead(s3StorageFunction);
    this.options.key.grantEncryptDecrypt(s3StorageFunction);

    new ErrorMonitoringAlarm(this, 'docstos3alarm', {
      criticality: new Criticality('high'),
      lambda: s3StorageFunction,
    });

    return s3StorageFunction;
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
      },
    });

    this.bucket.grantPut(forwarder);
    this.esbQueue.grantSendMessages(forwarder);
    this.parameters.objectsApikey.grantRead(forwarder);
    this.parameters.mijnServicesOpenZaakApiClientId.grantRead(forwarder);
    this.parameters.mijnServicesOpenZaakApiClientSecret.grantRead(forwarder);
    this.options.key.grantEncryptDecrypt(forwarder);

    new ErrorMonitoringAlarm(this, 'alarm', {
      criticality: new Criticality('high'),
      lambda: forwarder,
    });

    return forwarder;
  }

  private setupOrchestrationStepFunction(
    documentStorageLambda: Function,
    forwarderLambda: Function,
    notificationEmailLambda: Function,
    zgwLambda: Function,
    esfQueue: Queue,
  ) {

    const logGroup = new LogGroup(this, 'orchestrator-logs', {
      encryptionKey: this.options.key,
    });

    const stepfunction = new StateMachine(this, 'orchestrator', {
      comment: 'Orchestrates handling of the open-forms submissions',
      tracingEnabled: true,
      definitionBody: DefinitionBody.fromFile('src/submission-forwarder/orchestration.asl.json'),
      definitionSubstitutions: {
        BACKUP_BUCKET_NAME: this.backupBucket.bucketName,
        S3_STORAGE_LAMBDA_ARN: documentStorageLambda.functionArn,
        FORWARDER_LAMBDA_ARN: forwarderLambda.functionArn,
        NOTIFICATION_EMAIL_LAMBDA_ARN: notificationEmailLambda.functionArn,
        ZGW_REGISTRATION_LAMBDA_ARN: zgwLambda.functionArn,
        ESF_QUEUE_URL: esfQueue.queueUrl,
      },
      encryptionConfiguration: new CustomerManagedEncryptionConfiguration(this.options.key),
      logs: {
        destination: logGroup,
        level: LogLevel.ALL,
      },
    });

    // Make sure the stepfunction has the correct rights
    zgwLambda.grantInvoke(stepfunction);
    documentStorageLambda.grantInvoke(stepfunction);
    forwarderLambda.grantInvoke(stepfunction);
    notificationEmailLambda.grantInvoke(stepfunction);
    esfQueue.grantSendMessages(stepfunction);
    this.backupBucket.grantWrite(stepfunction);
    stepfunction.addToRolePolicy(new PolicyStatement({
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
        'xray:GetSamplingRules',
        'xray:GetSamplingTargets',
      ],
      effect: Effect.ALLOW,
      resources: ['*'],
    }));

    // Make sure we get a notification if an execution fails
    stepfunction.metricFailed({
      period: Duration.minutes(5),
      statistic: Stats.SUM,
    }).createAlarm(this, 'execution-failed-alarm', {
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmName: 'submission-orchestrator-failed-alarm' + this.options.criticality.alarmSuffix(),
    });

    // TODO add alarms for timeout and maybe aborted? https://docs.aws.amazon.com/step-functions/latest/dg/procedure-cw-metrics.html

    return stepfunction;
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
    return role;
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

  private setupZgwRegistrationLambda() {

    if (!this.parameters) {
      throw Error('Expected parameters to be defined');
    }

    const zgwLambda = new ZgwRegistrationFunction(this, 'zgw-function', {
      description: 'Registers submissions in ZGW',
      environment: {
        POWERTOOLS_LOG_LEVEL: this.options.logLevel ?? 'DEBUG',
        DOCUMENTEN_BASE_URL: this.parameters.documentenApiBaseUrl.stringValue,
        ZAKEN_BASE_URL: this.parameters.zakenApiBaseUrl.stringValue,
        CATALOGI_BASE_URL: this.parameters.catalogiApiBaseUrl.stringValue,
        OBJECTS_API_APIKEY_ARN: this.parameters.objectsApikey.secretArn,
        MIJN_SERVICES_OPEN_ZAAK_CLIENT_ID_SSM: this.parameters.mijnServicesOpenZaakApiClientId.parameterName,
        MIJN_SERVICES_OPEN_ZAAK_CLIENT_SECRET_ARN: this.parameters.mijnServicesOpenZaakApiClientSecret.secretArn,
      },
    });
    this.parameters.objectsApikey.grantRead(zgwLambda);
    this.parameters.mijnServicesOpenZaakApiClientId.grantRead(zgwLambda);
    this.parameters.mijnServicesOpenZaakApiClientSecret.grantRead(zgwLambda);
    this.options.key.grantEncryptDecrypt(zgwLambda);

    return zgwLambda;
  }

  private setupNotificationMailLambda() {
    const accountHostedZoneName = StringParameter.valueForStringParameter(this, Statics.accountRootHostedZoneName);
    const internalNotificationMailLambda = new InternalNotificationMailFunction(this, 'internal-notification-function', {
      description: 'Sends internal notification emails',
      environment: {
        POWERTOOLS_LOG_LEVEL: this.options.logLevel ?? 'DEBUG',
        MAIL_FROM_DOMAIN: accountHostedZoneName,
      },
    });
    internalNotificationMailLambda.addToRolePolicy(new PolicyStatement({
      resources: ['*'],
      actions: [
        'ses:SendEmail',
        'ses:SendRawEmail',
      ],
    }));

    return internalNotificationMailLambda;
  }

  private setupResubmitLambda(orchestrator: StateMachine) {

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
        ORCHESTRATOR_ARN: orchestrator.stateMachineArn,
      },
    });
    apikey.grantRead(resubmitLambda);
    this.bucket.grantRead(resubmitLambda);

    // Setup API gateway path
    const resource = this.options.resource.addResource('resubmit');
    resource.addMethod('POST', new LambdaIntegration(resubmitLambda));

  }

}

class ForwarderParameters extends Construct {
  public supportedObjectTypes: StringParameter;
  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.addForwarderParameters();
  }

  addForwarderParameters() {
    this.supportedObjectTypes = new StringParameter(this, 'objectTypes', {
      stringValue: 'submission##https://example.com/objecttypes/api/v2/objecttypes/d3713c2b-307c-4c07-8eaa-c2c6d75869cf;esftaak##https://example.com/objecttypes/api/v2/objecttypes/6df21057-e07c-4909-8933-d70b79cfd15e',
      description: 'name##url pairs (semi-colon-separated) defining supported objecttypes',
    });
  }
}
