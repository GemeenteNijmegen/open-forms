import { SubmissionLogGroupTag } from '../../../../shared/submission-logging/SubmissionLogging';
import { buildReceiverQuery } from '../SubmissionReceiverCwliQuery';

describe('buildReceiverQuery', () => {
  test('selects the receiver log groups by tag', () => {
    const query = buildReceiverQuery('abc-123');
    expect(query).toContain(`'key':'${SubmissionLogGroupTag.KEY}'`);
    expect(query).toContain(`'${SubmissionLogGroupTag.RECEIVER}'`);
  });

  test('filters on the requested objectUuid, not objectIndex', () => {
    const query = buildReceiverQuery('abc-123');
    expect(query).toContain('filter objectUuid = "abc-123"');
    expect(query).not.toMatch(/filter.*objectIndex/);
  });

  test('selects objectTypeUrl but not the reserved objectType field', () => {
    const query = buildReceiverQuery('abc-123');
    expect(query).toContain('objectTypeUrl');
    expect(query).not.toMatch(/\bobjectType\b/);
  });

  test('sorts ascending on @timestamp', () => {
    expect(buildReceiverQuery('abc-123')).toContain('sort @timestamp asc');
  });
});
