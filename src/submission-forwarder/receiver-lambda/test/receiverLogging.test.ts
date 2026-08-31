import { Logger } from '@aws-lambda-powertools/logger';
import { SubmissionLogEvent } from '../../../shared/submission-logging/SubmissionLogging';
import { logReceiverEvent } from '../ReceiverLogging';

describe('ReceiverLogging', () => {
  test('logger.info() throwing does not escape logReceiverEvent()', () => {
    const logger = new Logger();
    jest.spyOn(logger, 'info').mockImplementation(() => { throw new Error('boom'); });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => logReceiverEvent(logger, SubmissionLogEvent.NOTIFICATION_RECEIVED)).not.toThrow();
    expect(console.error).toHaveBeenCalledWith('Receiver structured logging failed', expect.objectContaining({
      event: SubmissionLogEvent.NOTIFICATION_RECEIVED,
      reason: 'boom',
    }));
  });

  test('a failing console.error fallback still does not escape logReceiverEvent()', () => {
    const logger = new Logger();
    jest.spyOn(logger, 'info').mockImplementation(() => { throw new Error('boom'); });
    jest.spyOn(console, 'error').mockImplementation(() => { throw new Error('fallback also broken'); });

    expect(() => logReceiverEvent(logger, SubmissionLogEvent.NOTIFICATION_RECEIVED)).not.toThrow();
  });

  test('missing context does not cause a failure', () => {
    const logger = new Logger();
    jest.spyOn(logger, 'info').mockImplementation(() => {});

    expect(() => logReceiverEvent(logger, SubmissionLogEvent.OBJECT_FETCH_STARTED)).not.toThrow();
  });

  test('ESF status is read from the raw zgwObject before an enriched result exists', () => {
    const logger = new Logger();
    const info = jest.spyOn(logger, 'info').mockImplementation(() => {});

    const zgwObject = {
      type: 'https://example.com/objecttype',
      url: 'https://example.com/object/1',
      uuid: '02e286e7-934a-4301-a523-a7870116fd84',
      record: { data: { formtaak: {}, status: 'open' } },
    } as any;

    logReceiverEvent(logger, SubmissionLogEvent.OBJECT_IGNORED, { zgwObject });

    expect(info).toHaveBeenCalledWith(SubmissionLogEvent.OBJECT_IGNORED, expect.objectContaining({
      esfStatus: 'open',
    }));
  });
});
