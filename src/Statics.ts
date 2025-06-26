export class Statics {
  static readonly projectName = 'open-forms';
  static readonly projectRepo = 'GemeenteNijmegen/open-forms';
  static readonly organization = 'GemeenteNijmegen';

  // Hostedzone managed in dns-managment project:
  static readonly accountRootHostedZonePath: string = '/gemeente-nijmegen/account/hostedzone/';
  static readonly accountRootHostedZoneId: string = '/gemeente-nijmegen/account/hostedzone/id';
  static readonly accountRootHostedZoneName: string = '/gemeente-nijmegen/account/hostedzone/name';

  // MARK: SSM Parameters
  static readonly ssmDummyParameter = `/${Statics.projectName}/dummy/parameter`;

  // MARK: Environments
  static readonly gnBuildEnvironment = {
    account: '836443378780',
    region: 'eu-central-1',
  };

  static readonly gnOpenFormsAccp = {
    account: '043309345347',
    region: 'eu-central-1',
  };

  static readonly gnOpenFormsProd = {
    account: '761018864362',
    region: 'eu-central-1',
  };

  // SNS Topic Subscription URLs
  static readonly ssmSNSSubscriptionUrlVIP = '/sns/subscriptionurl/vip';
  static readonly ssmSNSSubscriptionUrlJZ4ALL = '/sns/subscriptionurl/jz4all';

  // SNS Topic Subscription URLs
  // static readonly wowebSnsSubscriptionUrlAccp: string = 'https://vip.woweb.app/api/sns-receiver';
  // static readonly wowebSnsSubscriptionUrlProd: string = 'https://vip.nijmegen.cloud/api/sns-receiver';
  // static readonly wowebSnsSubscriptionUrlJz4allAccp: string = 'https://jz4all.woweb.app/api/sns-receiver';
  // static readonly wowebSnsSubscriptionUrlJz4allProd: string = 'https://jz4all.nijmegen.cloud/api/sns-receiver';
}
