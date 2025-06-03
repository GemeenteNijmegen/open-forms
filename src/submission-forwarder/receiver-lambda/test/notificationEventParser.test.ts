import { APIGatewayProxyEvent } from 'aws-lambda';
import { NotificationEventParser } from '../NotificationEventParser';
import * as notificationEvent from './samples/notificationEvent.json';

test('Parsing an APIGateway Event containing a notificatio', async() => {
  expect(NotificationEventParser.parse(notificationEvent as unknown as APIGatewayProxyEvent)).toBeTruthy();
})
