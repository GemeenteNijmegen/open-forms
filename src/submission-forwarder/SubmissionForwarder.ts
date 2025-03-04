import { Criticality, DeadLetterQueue } from '@gemeentenijmegen/aws-constructs';
import { Duration } from 'aws-cdk-lib';
import { LambdaIntegration, Resource } from 'aws-cdk-lib/aws-apigateway';
import { AccessKey, Role, User } from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ForwarderFunction } from './lambda/forwarder-function';

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
  private readonly queue: Queue;
  private readonly bucket: Bucket;
  private readonly apikey: Secret;
  private readonly parameters?: {
    objectsApikey: Secret;
    documentenApiBaseUrl: StringParameter;
    documentenApiClientId: StringParameter;
    documentenApiClientSecret: Secret;
  };
  constructor(scope: Construct, id: string, private readonly options: SubmissionForwarderOptions) {
    super(scope, id);

    this.queue = this.setupEsbQueue();
    this.parameters = this.setupParameters();
    this.bucket = this.setupSubmissionsBucket();
    this.apikey = this.setupApiKeySecret();

    this.setupEsbUser();
    this.setupLambda();
  }

  private setupSubmissionsBucket() {
    return new Bucket(this, 'submissions-bucket', {
      encryptionKey: this.options.key,
      bucketKeyEnabled: true, // Save cost
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });
  }

  private setupApiKeySecret() {
    return new Secret(this, 'api-key', {
      description: 'API Key for authentication in submission forwarder',
      generateSecretString: {
        excludePunctuation: true,
      },
    });
  }

  private setupParameters() {
    const objectsApikey = new Secret(this, 'objects-apikey', {
      description: 'API key used by submission forwarder for authentication at Objects API',
    });

    const documentenApiBaseUrl = new StringParameter(this, 'documentenApiBaseUrl', {
      stringValue: '-',
      description: 'Base URL used by submission-forwarder to reach the documenten API',
    });

    const documentenApiClientId = new StringParameter(this, 'documentenApiClientId', {
      stringValue: 'submission-forwarder',
      description: 'Client ID used by submission-forwarder to authenticate at documenten API',
    });

    const documentenApiClientSecret = new Secret(this, 'documentenApiClientSecret', {
      description: 'Client secret used by submission-forwarder to authenticate at documenten API',
    });

    return {
      objectsApikey,
      documentenApiBaseUrl,
      documentenApiClientId,
      documentenApiClientSecret,
    };
  }

  private setupLambda() {
    const logs = new LogGroup(this, 'logs', {
      encryptionKey: this.options.key,
      retention: RetentionDays.SIX_MONTHS,
    });

    if (!this.parameters) {
      throw Error('Parameters should be created first');
    }

    const forwarder = new ForwarderFunction(this, 'forwarder', {
      logGroup: logs,
      timeout: Duration.minutes(5), // Allow to run for a long time as we need to download/upload multiple documents
      environment: {
        API_KEY_ARN: this.apikey.secretArn,
        POWERTOOLS_LOG_LEVEL: this.options.logLevel ?? 'DEBUG',

        // Provided directly trough env.
        SUBMISSION_BUCKET_NAME: this.bucket.bucketName,
        DOCUMENTEN_BASE_URL: this.parameters.documentenApiBaseUrl.stringValue,

        // Loaded dynamically
        OBJECTS_API_APIKEY_ARN: this.parameters.objectsApikey.secretArn,
        DOCUMENTEN_CLIENT_ID_SSM: this.parameters.documentenApiClientId.parameterName,
        DOCUMENTEN_CLIENT_SECRET_ARN: this.parameters.documentenApiClientSecret.secretArn,
      },
    });
    this.bucket.grantPut(forwarder);
    this.apikey.grantRead(forwarder);
    this.parameters.objectsApikey.grantRead(forwarder);
    this.parameters.documentenApiClientId.grantRead(forwarder);
    this.parameters.documentenApiClientSecret.grantRead(forwarder);

    this.options.key.grantEncryptDecrypt(forwarder);
    this.options.resource.addMethod('POST', new LambdaIntegration(forwarder));
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

    this.queue.grantConsumeMessages(role);
    this.bucket.grantRead(role);
    this.options.key.grantDecrypt(role);
  }

}