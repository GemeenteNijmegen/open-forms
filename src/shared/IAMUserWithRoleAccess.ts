import { AccessKey, User, Role } from 'aws-cdk-lib/aws-iam';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

/**
 * Properties for creating a user + role with access key.
 *
 * @property userIdentifier A short name used to label the IAM user, role, and secret.
 * @property description Optional description for the IAM role for easy recognition in the console.
 */
export interface IamUserWithRoleAccessProps {
  userIdentifier: string;
  description?: string;
}

/**
 * Construct that creates an IAM user, access key (in Secrets Manager),
 * and an IAM role that can be assumed by the user.
 *
 * Example usage:
 *
 * ```ts
 * const access = new IamUserWithRoleAccess(this, 'esb-user-role-access', {
 *   userIdentifier: 'esb',
 *   description: 'Access role for ESB system user',
 * });
 *
 * // Access the user, and role:
 * const esbUser = access.user;
 * const esbRole = access.role;
 *
 * // Grant permissions to the role:
 * myBucket.grantRead(esbRole);
 * myQueue.grantConsumeMessages(esbRole);
 * ```
 */
export class IamUserWithRoleAccess extends Construct {
  public readonly user: User;
  public readonly role: Role;
  public readonly secret: Secret;

  constructor(scope: Construct, id: string, props: IamUserWithRoleAccessProps) {
    super(scope, id);

    const { userIdentifier, description } = props;

    this.user = new User(this, `${userIdentifier}-user`, {
      userName: `${userIdentifier}-user`,
    });

    const accessKey = new AccessKey(this, `${userIdentifier}-access-key`, {
      user: this.user,
    });

    this.secret = new Secret(this, `${userIdentifier}-access-key-secret`, {
      secretName: `${userIdentifier}-access-key`,
      secretStringValue: accessKey.secretAccessKey,
      description: `Secret access key for IAM user ${userIdentifier}-user`,
    });

    this.role = new Role(this, `${userIdentifier}-assumedby-role`, {
      roleName: `${userIdentifier}-role`,
      assumedBy: this.user,
      description:
        description ?? `Assumable role for IAM user ${userIdentifier}-user`,
    });
  }
}
