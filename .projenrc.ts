import { GemeenteNijmegenCdkApp } from '@gemeentenijmegen/projen-project-type';
const project = new GemeenteNijmegenCdkApp({
  cdkVersion: '2.1.0',
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
    '@types/aws-lambda@8.10.159',
    '@aws-sdk/client-dynamodb@3.966.0',
    '@aws-sdk/client-s3@3.966.0',
    '@aws-sdk/client-sqs@3.966.0',
    '@aws-sdk/client-sns@3.966.0',
    '@aws-sdk/client-sfn@3.966.0',
    '@aws-sdk/client-ses@3.966.0',
    '@aws-lambda-powertools/logger',
    'zod',
    '@gemeentenijmegen/modules-zgw-client',
    'jsonwebtoken',
    '@types/jsonwebtoken',
    '@aws-sdk/lib-storage@3.966.0',

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