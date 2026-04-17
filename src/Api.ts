import { RestApi, SecurityPolicy } from 'aws-cdk-lib/aws-apigateway';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { Key } from 'aws-cdk-lib/aws-kms';
import { IHostedZone, ARecord, RecordTarget, HostedZone } from 'aws-cdk-lib/aws-route53';
import { ApiGatewayDomain } from 'aws-cdk-lib/aws-route53-targets';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Configurable, Configuration } from './Configuration';
import { PrefillDemo } from './prefill-demo/PrefillDemoConstruct';
import { Statics } from './Statics';
import { SubmissionForwarder } from './submission-forwarder/SubmissionForwarder';

interface ApiProps extends Configurable {
  key: Key;
}
/**
 * PrefillApi sets up a REST API with endpoints for prefilling specific
 * forms. Only used for complex forms, or forms with dynamic data that can't be
 * accessed using supported patterns.
 */
export class Api extends Construct {
  private hostedzone: IHostedZone;
  public restApi: RestApi;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);
    this.hostedzone = this.importHostedzone();
    this.setupRestApi(props.key, props.configuration);
  }

  private setupRestApi(key: Key, configuration: Configuration) {
    const domain = `form-api.${this.hostedzone.zoneName}`;
    const cert = new Certificate(this, 'certificate', {
      domainName: domain,
      validation: CertificateValidation.fromDns(this.hostedzone),
    });

    this.restApi = new RestApi(this, 'api', {
      domainName: {
        certificate: cert,
        domainName: domain,
        securityPolicy: SecurityPolicy.TLS_1_2,
      },
    });

    this.createUsagePlan();
    this.addDnsRecords(domain);
    this.addRoutes(key);
    this.addForwarder(configuration, key);
  }

  private addForwarder(configuration: Configuration, key: Key) {
    const forwarderResource = this.restApi.root.addResource('submission-forwarder');
    new SubmissionForwarder(this, 'submission-forwarder', {
      key,
      resource: forwarderResource,
      criticality: configuration.criticality,
      useVipJzProductionMapping: configuration.branch == 'main', // TODO remove when we can use ZGW to register submisisons in VIP/JZ4ALL
      logLevel: configuration.logLevel ?? 'INFO',
      urlSubscriptions: configuration.urlSubscriptions,
    });

  }

  private addDnsRecords(domain: string) {
    new ARecord(this, 'a-record', {
      target: RecordTarget.fromAlias(new ApiGatewayDomain(this.restApi.domainName!)),
      zone: this.hostedzone,
      recordName: domain,
    });
  }

  private createUsagePlan() {
    const plan = this.restApi.addUsagePlan('UsagePlan', {
      description: 'OpenForms supporting infra API gateway',
      apiStages: [
        {
          api: this.restApi,
          stage: this.restApi.deploymentStage,
        },
      ],
    });

    const key = this.restApi.addApiKey('ApiKey', {
      description: 'OpenForms supporting infra API key',
    });

    plan.addApiKey(key);
  }

  private addRoutes(key: Key) {
    // Setup a dummy prefill lambda for testing purposes
    const prefillDemo = this.restApi.root.addResource('prefill-demo');
    new PrefillDemo(this, 'prefill-demo', {
      key,
      resource: prefillDemo,
    });
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
