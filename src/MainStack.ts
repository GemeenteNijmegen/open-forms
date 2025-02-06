import { Stack, StackProps } from 'aws-cdk-lib';
import { RestApi, SecurityPolicy } from 'aws-cdk-lib/aws-apigateway';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { Key } from 'aws-cdk-lib/aws-kms';
import { ARecord, HostedZone, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGatewayDomain } from 'aws-cdk-lib/aws-route53-targets';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { PrefillDemo } from './prefill-demo/PrefillDemoConstruct';
import { Statics } from './Statics';

interface MainStackProps extends StackProps, Configurable {}

export class MainStack extends Stack {

  private readonly hostedzone: IHostedZone;
  private readonly api: RestApi;
  private readonly key: Key | undefined;

  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, props);

    this.key = this.setupKmsKey();
    this.hostedzone = this.importHostedzone();
    this.api = this.setupRestApi();

    const prefillDemo = this.api.root.addResource('prefill-demo');

    new PrefillDemo(this, 'prefill-demo', {
      key: this.key,
      resource: prefillDemo,
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

    new ARecord(this, 'a-record', {
      target: RecordTarget.fromAlias(new ApiGatewayDomain(api.domainName!)),
      zone: this.hostedzone,
      recordName: domain,
    });

    return api;
  }

  private setupKmsKey() {
    return new Key(this, 'key', {
      description: 'For encrypting data related to open-forms',
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