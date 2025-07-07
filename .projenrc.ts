import { GemeenteNijmegenCdkApp } from '@gemeentenijmegen/projen-project-type';
const project = new GemeenteNijmegenCdkApp({
  cdkVersion: '2.203.1',
  defaultReleaseBranch: 'main',
  devDeps: ['@gemeentenijmegen/projen-project-type', 'aws-sdk-client-mock'],
  name: 'open-forms',
  projenrcTs: true,
  deps: [
    'dotenv',
    '@gemeentenijmegen/aws-constructs',
    '@gemeentenijmegen/design-tokens',
    '@gemeentenijmegen/apigateway-http',
    '@gemeentenijmegen/utils',
    'jose',
    '@types/aws-lambda',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/client-s3',
    '@aws-sdk/client-sqs',
    '@aws-sdk/client-sns',
    '@aws-sdk/client-sfn',
    '@aws-sdk/client-ses',
    '@aws-lambda-powertools/logger',
    'zod',
    '@gemeentenijmegen/modules-zgw-client',
    'jsonwebtoken',
    '@types/jsonwebtoken',
    '@aws-sdk/lib-storage',

  ],
  jestOptions: {
    jestConfig: {
      setupFiles: ['dotenv/config'],
    },
  },
  gitignore: [
    'test.pdf', // Data from live test
    '**/excludedformdefinitions/',
    '**/output/',
  ],
});


/**
 * Supress the 'dependency should be included in the project dependencies' error.
 */
project.eslint?.addOverride({
  rules: {
    'import/no-extraneous-dependencies': ['off'],
  },
  files: ['*.ts'],
});


project.synth();