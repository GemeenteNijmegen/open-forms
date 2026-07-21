import * as asl from '../orchestration.asl.json';

const STANDARD_RETRY = [{
  ErrorEquals: ['Lambda.ServiceException', 'Lambda.AWSLambdaException', 'Lambda.SdkClientException', 'Lambda.TooManyRequestsException'],
  IntervalSeconds: 1,
  MaxAttempts: 3,
  BackoffRate: 2,
  JitterStrategy: 'FULL',
}];

// States without the standard retry block. Not something to "fix" here — just
// recorded so an accidental change to them shows up in the diff.
const LAMBDA_INVOKE_TASKS_WITHOUT_STANDARD_RETRY = ['Sociaal Internal Notification Email', 'Register ZGW'];

describe('orchestration.asl.json', () => {
  test('uses JSONata as the query language', () => {
    expect((asl as any).QueryLanguage).toBe('JSONata');
  });

  test('starts at "Log object"', () => {
    expect((asl as any).StartAt).toBe('Log object');
  });

  test('"Store files in S3" still transitions to "Tribe or Networkshare ESF VIP or Sociaal"', () => {
    expect((asl as any).States['Store files in S3'].Next).toBe('Tribe or Networkshare ESF VIP or Sociaal');
  });

  test('"Success" is a Succeed state', () => {
    expect((asl as any).States.Success).toEqual({ Type: 'Succeed' });
  });

  test('every lambda:invoke task keeps the standard retry block, except the known existing exceptions', () => {
    const states: Record<string, any> = (asl as any).States;
    const lambdaInvokeTasks = Object.entries(states).filter(([, state]) => state.Resource === 'arn:aws:states:::lambda:invoke');
    expect(lambdaInvokeTasks.length).toBeGreaterThan(0);

    for (const [name, state] of lambdaInvokeTasks) {
      if (LAMBDA_INVOKE_TASKS_WITHOUT_STANDARD_RETRY.includes(name)) {
        continue;
      }
      expect(state.Retry).toEqual(STANDARD_RETRY);
    }
  });

  test('existing non-Tribe routes out of "Tribe or Networkshare ESF VIP or Sociaal" are unchanged (statusformulier, VIP/JZ4ALL, Sociaal, networkshare)', () => {
    const choices: any[] = (asl as any).States['Tribe or Networkshare ESF VIP or Sociaal'].Choices;
    const byComment = Object.fromEntries(choices.map(c => [c.Comment, c.Next]));
    expect(byComment['has statusformulier URL']).toBe('ESF ESB Queue');
    expect(byComment['VIP/JZ4ALL']).toBe('VIP/JZ4ALL forward');
    expect(byComment['Sociaal Domein Aanvraag']).toBe('Sociaal To ESB Folder?');
    expect(byComment['contains networkshare / monitoring']).toBe('ESB Forwarder');
    expect((asl as any).States['Tribe or Networkshare ESF VIP or Sociaal'].Default).toBe('ZGW registration?');
  });

  test('a Tribe input (tribeEnvironment present) is routed to TribeProcessor, checked before the overlapping networkshare condition', () => {
    const choices: any[] = (asl as any).States['Tribe or Networkshare ESF VIP or Sociaal'].Choices;
    const tribeIndex = choices.findIndex(c => c.Next === 'TribeProcessor');
    const networkshareIndex = choices.findIndex(c => c.Comment === 'contains networkshare / monitoring');
    expect(tribeIndex).toBeGreaterThanOrEqual(0);
    expect(tribeIndex).toBeLessThan(networkshareIndex);
    expect(choices[tribeIndex].Condition).toContain('enrichedObject.tribeEnvironment');
  });

  test('TribeProcessor is a lambda:invoke task using TRIBE_PROCESSOR_LAMBDA_ARN, and ends at Success', () => {
    const tribeProcessor: any = (asl as any).States.TribeProcessor;
    expect(tribeProcessor.Type).toBe('Task');
    expect(tribeProcessor.Resource).toBe('arn:aws:states:::lambda:invoke');
    expect(tribeProcessor.Arguments.FunctionName).toBe('${TRIBE_PROCESSOR_LAMBDA_ARN}');
    expect(tribeProcessor.Retry).toEqual(STANDARD_RETRY);
    expect(tribeProcessor.Next).toBe('Success');
  });

  test('the full state machine matches the recorded baseline snapshot', () => {
    expect(asl).toMatchSnapshot();
  });
});
