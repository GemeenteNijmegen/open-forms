import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { mockClient } from 'aws-sdk-client-mock';
import { ReceiverHandler } from '../Handler';
import * as esfTaakSample from './samples/esfTaak.json';

/**
 * Regression tests for the "invalid e-mail => 500" bug: schema validation
 * failures (ZodError) bubbling out of the parser must be answered with a
 * 400 (client error), never a 500 (server error).
 */
describe('receiver - ESF taak e-mail validation', () => {
  const stepfunctionMock = mockClient(SFNClient);
  const dynamodb = mockClient(DynamoDBClient);

  const supportedObjectTypes = `esfTaak##${esfTaakSample.type}`;

  const notificationEvent = {
    body: JSON.stringify({
      actie: 'update',
      kanaal: 'objecten',
      hoofdObject: esfTaakSample.url,
      resourceUrl: esfTaakSample.url,
      resource: 'object',
      aanmaakdatum: '2025-01-01',
    }),
  };

  /** Fresh deep clone of the sample object so tests cannot leak into each other. */
  function cloneEsfTaakObject(): any {
    return JSON.parse(JSON.stringify(esfTaakSample));
  }

  function handlerFor(objectResponse: any) {
    const objectsApiClient = { getObject: jest.fn().mockResolvedValue(objectResponse) };
    const zgwClientFactory = {
      getObjectsApiClient: jest.fn().mockResolvedValue(objectsApiClient),
      getDocumentenClient: jest.fn().mockResolvedValue({}),
      getZakenClient: jest.fn().mockResolvedValue({}),
      getCatalogiClient: jest.fn().mockResolvedValue({}),
    };
    return new ReceiverHandler({
      logger: new Logger(),
      zgwClientFactory: zgwClientFactory as any,
      topicArn: 'arn:aws:sns:eu-central-1:123456789012:topic',
      orchestratorArn: 'arn:aws:states:eu-central-1:123456789012:stateMachine:orchestrator',
      supportedObjectTypes,
    });
  }

  beforeEach(() => {
    stepfunctionMock.reset();
    dynamodb.reset();
    stepfunctionMock.on(StartExecutionCommand).resolves({
      executionArn: 'arn:aws:states:eu-central-1:123456789012:execution:orchestrator:abc',
      startDate: new Date(),
    });
    dynamodb.on(PutItemCommand).resolves({});
  });

  test('returns 200 and starts execution for a valid ESF taak', async () => {
    const response = await handlerFor(cloneEsfTaakObject()).handle(notificationEvent as any);

    expect(response.statusCode).toBe(200);
    expect(stepfunctionMock.commandCalls(StartExecutionCommand).length).toBe(1);
  });

  test.each([
    ['not-an-email'],
    ['someone@'],
    ['@example.com'],
    ['two spaces @ example.com'],
    [''],
  ])('returns 400 (not 500) when verzonden_data.email is %p', async (invalidEmail) => {
    const object = cloneEsfTaakObject();
    object.record.data.formtaak.verzonden_data.email = invalidEmail;

    const response = await handlerFor(object).handle(notificationEvent as any);

    expect(response.statusCode).toBe(400);
    expect(stepfunctionMock.commandCalls(StartExecutionCommand).length).toBe(0);
  });

  test('does not leak the raw ZodError message in the response body', async () => {
    const object = cloneEsfTaakObject();
    object.record.data.formtaak.verzonden_data.email = 'broken';

    const response = await handlerFor(object).handle(notificationEvent as any);

    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain('verzonden_data');
  });

  test('still accepts an invalid prefill formtaak.data.email (untrusted prefill data)', async () => {
    const object = cloneEsfTaakObject();
    object.record.data.formtaak.data.email = 'garbage-prefill-value';

    const response = await handlerFor(object).handle(notificationEvent as any);

    expect(response.statusCode).toBe(200);
    expect(stepfunctionMock.commandCalls(StartExecutionCommand).length).toBe(1);
  });

  test('returns 400 when a required field is missing entirely', async () => {
    const object = cloneEsfTaakObject();
    delete object.record.data.formtaak.verzonden_data.email;

    const response = await handlerFor(object).handle(notificationEvent as any);

    expect(response.statusCode).toBe(400);
  });
});
