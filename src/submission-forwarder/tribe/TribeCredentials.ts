import { SecretValue } from 'aws-cdk-lib';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

const PLACEHOLDER_VALUE = 'VUL_HANDMATIG_IN';
const BASE_SECRET_NAME = '/open-forms/submissionforwarder/tribe/';

/**
 * One JSON secret per Tribe environment ({clientId, clientSecret}), with a
 * placeholder that gets filled in by hand after deployment. Only `AUTODELEN`
 * for now; a future Tribe environment (e.g. Energieloket) gets its own
 * `new Secret(...)` entry here once it's actually needed.
 */
export function setupTribeCredentials(scope: Construct): Record<string, Secret> {
  const autodelen = new Secret(scope, 'tribe-autodelen-credentials', {
    secretName: `${BASE_SECRET_NAME}autodelen/credentials`,
    description: 'OAuth2 client credentials (clientId + clientSecret) for the Tribe AUTODELEN environment. Fill in manually after deployment.',
    secretObjectValue: {
      clientId: SecretValue.unsafePlainText(PLACEHOLDER_VALUE),
      clientSecret: SecretValue.unsafePlainText(PLACEHOLDER_VALUE),
    },
  });
  return { AUTODELEN: autodelen };
}
