import { Criticality } from '@gemeentenijmegen/aws-constructs';
import { Environment } from 'aws-cdk-lib';
import { Statics } from './Statics';

/**
 * Adds a configuration field to another interface
 */
export interface Configurable {
  configuration: Configuration;
}

/**
 * Basic configuration options per environment
 */
export interface Configuration {
  /**
   * Branch name for the applicible branch (this branch)
   */
  branch: string;

  /**
   * The pipeline will run from this environment
   *
   * Use this environment for your initial manual deploy
   */
  buildEnvironment: Required<Environment>;

  /**
   * Environment to deploy the application to
   *
   * The pipeline (which usually runs in the build account) will
   * deploy the application to this environment. This is usually
   * the workload AWS account in our default region.
   */
  deploymentEnvironment: Required<Environment>;

  /**
   * Criticality for the branch
   */
  criticality: Criticality;

  /**
   * Loglevel default INFO (prod)
   */
  logLevel?: string;

  /**
   * SNS subscriptions (url and app id that is forwarded to this subscription)
   * @default - no subscriptions are deployed
   */
  urlSubscriptions?: { url: string; appId: string }[];

}

const EnvironmentConfigurations: { [key: string]: Configuration } = {
  acceptance: {
    branch: 'acceptance',
    buildEnvironment: Statics.gnBuildEnvironment,
    deploymentEnvironment: Statics.gnOpenFormsAccp,
    criticality: new Criticality('medium'),
    logLevel: 'DEBUG',
    urlSubscriptions: [
      {
        appId: 'APV',
        url: 'https://vip.woweb.app/api/sns-receiver',
      },
      {
        appId: 'JUR',
        url: 'https://jz4all.woweb.app/api/sns-receiver',
      },
    ],
  },
  main: {
    branch: 'main',
    buildEnvironment: Statics.gnBuildEnvironment,
    deploymentEnvironment: Statics.gnOpenFormsProd,
    criticality: new Criticality('high'),
    logLevel: 'INFO',
  },
};

/**
 * Retrieve a configuration object by passing a branch string
 *
 * **NB**: This retrieves the subobject with key `branchName`, not
 * the subobject containing the `branchName` as the value of the `branch` key
 *
 * @param branchName the branch for which to retrieve the environment
 * @returns the configuration object for this branch
 */
export function getEnvironmentConfiguration(branchName: string): Configuration {
  const conf = EnvironmentConfigurations[branchName];
  if (!conf) {
    throw Error(`No configuration found for branch ${branchName}`);
  }
  return conf;
}
