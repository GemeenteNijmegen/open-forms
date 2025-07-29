import { Stack, StackProps } from 'aws-cdk-lib';
import { RestApi, SecurityPolicy } from 'aws-cdk-lib/aws-apigateway';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { ARecord, HostedZone, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGatewayDomain } from 'aws-cdk-lib/aws-route53-targets';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { PrefillDemo } from './prefill-demo/PrefillDemoConstruct';
import { Statics } from './Statics';
import { SubmissionForwarder } from './submission-forwarder/SubmissionForwarder';

interface MainStackProps extends StackProps, Configurable { }

export class MainStack extends Stack {

  private readonly hostedzone: IHostedZone;
  private readonly api: RestApi;
  private readonly key: Key | undefined;

  constructor(scope: Construct, id: string, props: MainStackProps) {
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