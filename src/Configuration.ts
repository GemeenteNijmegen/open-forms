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
   * Configuration for deploying nl wallet infra
   * @default - no nl wallet infra is deployed
   */
  nlWalletConfiguration?: NlWalletConfiguration[];
}

interface NlWalletConfiguration {
  cdkId: string;
  /**
   * @default false
   */
  debug?: boolean;
  /**
   * Path to mount this service on in the API gateway
   * Used as /token-cache/{name}/{token or prefill}
   */
  pathName: string;
  /**
   * Endpoint to actually call for obtaining the token
   */
  tokenEndpoint: string;
}


const EnvironmentConfigurations: {[key:string]: Configuration} = {
  acceptance: {
    branch: 'acceptance',
    buildEnvironment: Statics.gnBuildEnvironment,
    deploymentEnvironment: Statics.gnOpenFormsAccp,
    nlWalletConfiguration: [
      {
        cdkId: 'caching-service',
        pathName: 'nlwallet',
        debug: true,
        tokenEndpoint: 'https://gemeente-nijmegen.sandbox.signicat.com/auth/open/connect/token',
      },
      {
        cdkId: 'caching-service-verid',
        pathName: 'nlwallet-verid',
        debug: true,
        tokenEndpoint: 'https://oauth.ssi.ver.id/token/grant',
      },
    ],
  },
  main: {
    branch: 'main',
    buildEnvironment: Statics.gnBuildEnvironment,
    deploymentEnvironment: Statics.gnOpenFormsProd,
    nlWalletConfiguration: [
      {
        cdkId: 'caching-service',
        pathName: 'nlwallet',
        debug: false,
        tokenEndpoint: 'https://gemeente-nijmegen.app.signicat.com/auth/open/connect/token',
      },
      {
        cdkId: 'caching-service-verid',
        pathName: 'nlwallet-verid',
        debug: false,
        tokenEndpoint: 'https://oauth.ssi.ver.id/token/grant',
      },
    ],
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
