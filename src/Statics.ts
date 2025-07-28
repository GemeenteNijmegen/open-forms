export class Statics {
  static readonly projectName = 'open-forms';
  static readonly projectRepo = 'GemeenteNijmegen/open-forms';
  static readonly organization = 'GemeenteNijmegen';

  // Hostedzone managed in dns-managment project:
  static readonly accountRootHostedZonePath: string = '/gemeente-nijmegen/account/hostedzone/';
  static readonly accountRootHostedZoneId: string = '/gemeente-nijmegen/account/hostedzone/id';
  static readonly accountRootHostedZoneName: string = '/gemeente-nijmegen/account/hostedzone/name';

  // Static RSIN for all environments
  static readonly GN_RSIN = '001479179';

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

  /**
 * KMS account key alias
 */
  static readonly ALIAS_ACCOUNT_KMS_KEY = 'alias/open-forms-account-kms-key';

  /**
   * Shared ARN SSM parameter names
   * These params point to shared resources in the Open Forms account
   * The role and sqs are used in two different Github repo's, but are present in the same gn-account
   * This repo sets the params, which will be retrieved by aanvragen-sociaal-domein github repo
   */
  static readonly ssmSharedSubmissionEsbRoleArn = '/shared/submission/esbrole/arn'; // Do not change or remove
  static readonly ssmSharedSubmissionSQSSociaalArn = '/shared/submission/sqs/sociaal/arn'; // Do not change or remove
  static readonly ssmSharedSubmissionSQSDLQSociaalArn = '/shared/submission/sqsdlq/sociaal/arn'; // Do not change or remove

  // SNS Topic Subscription URLs
  static readonly ssmSNSSubscriptionUrlVIP = '/sns/subscriptionurl/vip';
  static readonly ssmSNSSubscriptionUrlJZ4ALL = '/sns/subscriptionurl/jz4all';
}
