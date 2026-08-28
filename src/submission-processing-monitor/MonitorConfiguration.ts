import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { IStringParameter, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Statics } from '../Statics';


export class MonitorConfiguration extends Construct {
  public readonly objectsApiBaseUrl: StringParameter;
  public readonly objectsApiToken: Secret;
  public readonly submissionForwarderStateMachineArn: IStringParameter;
  public readonly objectTypes: IStringParameter;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.objectsApiBaseUrl = new StringParameter(this, 'objects-api-base-url-processing-monitor', {
      parameterName: Statics.ssmSubmissionProcessingMonitorObjectsApiBaseUrl,
      stringValue: '-',
      description: 'Base URL used by submission-processing-monitor to reach the Objects API, without trailing slash, '
        + 'e.g. https://domein.nl/objects/api/v2',
    });

    this.objectsApiToken = new Secret(this, 'objects-api-token-processing-monitor', {
      secretName: Statics.ssmSubmissionProcessingMonitorObjectsApiToken,
      description: 'Read-only token used by submission-processing-monitor to authenticate at the Objects API',
    });

    this.submissionForwarderStateMachineArn = StringParameter.fromStringParameterName(
      this,
      'submission-forwarder-state-machine-arn-processing-monitor',
      Statics.ssmSubmissionStateMachineArn,
    );

    this.objectTypes = StringParameter.fromStringParameterName(
      this,
      'object-types-processing-monitor',
      Statics.ssmObjectTypes,
    );
  }
}
