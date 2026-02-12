import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { LambdaIntegration, RestApi, SecurityPolicy } from 'aws-cdk-lib/aws-apigateway';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { ARecord, HostedZone, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGatewayDomain } from 'aws-cdk-lib/aws-route53-targets';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { PrefillDemo } from './prefill-demo/PrefillDemoConstruct';
import { StaticFormDefinitions } from './static-form-definitions/StaticFormDefinitions';
import { Statics } from './Statics';
import { SubmissionForwarder } from './submission-forwarder/SubmissionForwarder';
import { ErrorMonitoringAlarm } from '@gemeentenijmegen/aws-constructs';
import { PrefillFunction } from './prefill/prefill-function';

interface MainStackProps extends StackProps, Configurable { }

export class MainStack extends Stack {

  private readonly hostedzone: IHostedZone;
  private readonly api: RestApi;
  private readonly key: Key | undefined;

  constructor(scope: Construct, id: string, private props: MainStackProps) {
    super(scope, id, props);

    // Main encryption key for this project
    this.key = this.setupKmsKey();

    // Hosted zone and api-gateway
    this.hostedzone = this.importHostedzone();
    this.api = this.setupRestApi();

    // Setup a dummy prefill lambda for testing purposes
    const prefillDemo = this.api.root.addResource('prefill-demo');
    new PrefillDemo(this, 'prefill-demo', {
      key: this.key,
      resource: prefillDemo,
    });

    // Setup the submission forwarder
    const forwarderResource = this.api.root.addResource('submission-forwarder');
    new SubmissionForwarder(this, 'submission-forwarder', {
      key: this.key,
      resource: forwarderResource,
      criticality: props.configuration.criticality,
      useVipJzProductionMapping: props.configuration.branch == 'main', // TODO remove when we can use ZGW to register submisisons in VIP/JZ4ALL
      logLevel: props.configuration.logLevel ?? 'INFO',
      urlSubscriptions: props.configuration.urlSubscriptions,
    });

    this.setupStaticFromDefinitions();

    this.setupPrefill();

  }

  private setupPrefill() {
    const prefill = this.api.root.addResource('prefill');

    const prefillLambda = new PrefillFunction(this, 'prefill-lambda', {
      environment: {
        LOG_LEVEL: this.props.configuration.logLevel ? 'true' : 'false',
        IIT_AVI_PREFILL_ENDPOINT: StringParameter.valueForStringParameter(this, Statics.ssmName_individueleInkomensToeslagAviPrefillEndpoint),
      }
    })

    new ErrorMonitoringAlarm(this, 'prefill-lambda-alarm', {
      criticality: this.props.configuration.criticality.toString(),
      lambda: prefillLambda,
      errorRateProps: {
        alarmThreshold: 1,
        alarmEvaluationPeriods: 1,
        alarmEvaluationPeriod: Duration.minutes(15),
      },
    });

    //add throttling and api key
    const plan = this.api.addUsagePlan('usage-plan-prefill-api', {
      name: 'prefill',
      description: 'used for rate-limit and api key',
      throttle: {
        rateLimit: 5,
        burstLimit: 10,
      },
    });
    const key = this.api.addApiKey('api-key-prefill', {
      apiKeyName: 'prefill Api',
      description: 'gebruikt voor alle methods van prefill API',
    });

    plan.addApiKey(key);
    // plan.addApiStage({
    //   stage: this.api.deploymentStage,
    // }); Required?

    prefill.addMethod('POST', new LambdaIntegration(prefillLambda), {
      apiKeyRequired: true,
      requestParameters: {
        'method.request.querystring.formname': true,
      },
    });


  }

  /**
   * Bucket and endpoint for serving static form definitions
   */
  private setupStaticFromDefinitions() {
    new StaticFormDefinitions(this, 'static-form-definitions', {
      api: this.api,
      logLevel: this.props.configuration.logLevel ?? 'INFO',
    });
  }

  private setupRestApi() {
    const domain = `api.${this.hostedzone.zoneName}`;
    const cert = new Certificate(this, 'certificate', {
      domainName: domain,
      validation: CertificateValidation.fromDns(this.hostedzone),
    });

    const api = new RestApi(this, 'api', {
      domainName: {
        certificate: cert,
        domainName: domain,
        securityPolicy: SecurityPolicy.TLS_1_2,
      },
    });

    const plan = api.addUsagePlan('UsagePlan', {
      description: 'OpenForms supporting infra API gateway',
      apiStages: [
        {
          api: api,
          stage: api.deploymentStage,
        },
      ],
    });

    const key = api.addApiKey('ApiKey', {
      description: 'OpenForms supporting infra API key',
    });

    plan.addApiKey(key);

    new ARecord(this, 'a-record', {
      target: RecordTarget.fromAlias(new ApiGatewayDomain(api.domainName!)),
      zone: this.hostedzone,
      recordName: domain,
    });

    return api;
  }

  private setupKmsKey() {
    const key = new Key(this, 'key', {
      description: 'For encrypting data related to open-forms',
    });

    key.addToResourcePolicy(new PolicyStatement({
      actions: [
        'kms:Encrypt*',
        'kms:Decrypt*',
        'kms:ReEncrypt*',
        'kms:GenerateDataKey*',
        'kms:Describe*',
      ],
      effect: Effect.ALLOW,
      resources: ['*'],
      principals: [new ServicePrincipal(`logs.${Stack.of(this).region}.amazonaws.com`)],
    }));

    /**
     * Add Alias to key for shared use in the account
     */
    key.addAlias(Statics.ALIAS_ACCOUNT_KMS_KEY);

    new StringParameter(this, 'ssm-account-shared-kms-key-arn', {
      parameterName: Statics.ssmAccountSharedKmsKeyArn,
      stringValue: key.keyArn,
      description: 'Account shared KMS key ARN',
    });
    return key;
  }

  private importHostedzone() {
    const accountRootZoneId = StringParameter.valueForStringParameter(this, Statics.accountRootHostedZoneId);
    const accountRootZoneName = StringParameter.valueForStringParameter(this, Statics.accountRootHostedZoneName);
    return HostedZone.fromHostedZoneAttributes(this, 'hostedzone', {
      hostedZoneId: accountRootZoneId,
      zoneName: accountRootZoneName,
    });
  }

}