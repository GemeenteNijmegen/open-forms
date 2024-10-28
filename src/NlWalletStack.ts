import { Stack, StackProps } from 'aws-cdk-lib';
import { RestApi, SecurityPolicy } from 'aws-cdk-lib/aws-apigateway';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { Key } from 'aws-cdk-lib/aws-kms';
import { HostedZone, IHostedZone } from 'aws-cdk-lib/aws-route53';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { TokenCacheService } from './nl-wallet/TokenCachingService';
import { Statics } from './Statics';

interface NlWalletStackProps extends StackProps, Configurable {}

export class NlWalletStack extends Stack {

  private readonly hostedzone: IHostedZone;
  private readonly api: RestApi;
  private readonly key: Key | undefined;

  constructor(scope: Construct, id: string, props: NlWalletStackProps) {
    super(scope, id, props);
    if (props.configuration.nlWalletConfiguration?.useCMK) {
      this.key = this.setupKmsKey();
    }
    this.hostedzone = this.importHostedzone();
    this.api = this.setupRestApi();
    new TokenCacheService(this, 'caching-service', {
      api: this.api,
      key: this.key,
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

    return api;
  }


  private setupKmsKey() {
    return new Key(this, 'key', {
      description: 'For encrypting data stored in NL Wallet token caching service',
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