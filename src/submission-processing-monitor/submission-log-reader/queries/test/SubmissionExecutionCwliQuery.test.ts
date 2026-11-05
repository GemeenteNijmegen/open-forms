import { SubmissionLogGroupTag } from '../../../../shared/submission-logging/SubmissionLogging';
import { buildExecutionQuery } from '../SubmissionExecutionCwliQuery';

describe('buildExecutionQuery', () => {
  const arn1 = 'arn:aws:states:eu-central-1:123456789012:execution:orchestrator:OF-AAAAAA-1';
  const arn2 = 'arn:aws:states:eu-central-1:123456789012:execution:orchestrator:OF-BBBBBB-2';

  test('selects the orchestrator log groups by tag', () => {
    const query = buildExecutionQuery([arn1]);
    expect(query).toContain(`'key':'${SubmissionLogGroupTag.KEY}'`);
    expect(query).toContain(`'${SubmissionLogGroupTag.ORCHESTRATOR}'`);
  });

  test('filters on every requested execution_arn', () => {
    const query = buildExecutionQuery([arn1, arn2]);
    expect(query).toContain(`filter execution_arn in ["${arn1}", "${arn2}"]`);
  });

  test('selects the native Step Functions fields', () => {
    const query = buildExecutionQuery([arn1]);
    expect(query).toContain('type');
    expect(query).toContain('previous_event_id');
    expect(query).toContain('event_timestamp');
    expect(query).toContain('redrive_count');
  });

  test('selects @message instead of details, which CWLI cannot return as a nested object', () => {
    expect(buildExecutionQuery([arn1])).toContain('@message');
  });
});
