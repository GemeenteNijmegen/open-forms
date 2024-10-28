export class Statics {
  static readonly projectName = 'open-forms';
  static readonly projectRepo = 'GemeenteNijmegen/open-forms';
  static readonly organization = 'GemeenteNijmegen';

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
    account: '', // TODO fill once account is created
    region: 'eu-central-1',
  };

}
