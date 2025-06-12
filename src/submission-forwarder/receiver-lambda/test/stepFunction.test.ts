import { StepFunction } from '../StepFunction';

describe('Stepfunction', () => {
  test('Should be able to create', async() => {
    expect(new StepFunction('somearn')).toBeTruthy();
  });
});

describe('Sanitize execution ID', () => {
  let stepFunction: StepFunction;
  beforeAll(async() => {
    stepFunction = new StepFunction('executionId');
  });

  test('passing executionIDs sanitizes as expected', async() => {
    const sanitizedExecutionIdTuples = [
      ['a'.repeat(80), 'a'.repeat(80)],
      ['a'.repeat(90), 'a'.repeat(80)],
      ['abc123!@#def-__', 'abc123def-__'],
      ['!@#$%^&*()', ''],
      ['A1-2_b', 'A1-2_b'],
      [`@#${'a'.repeat(80)}@#!`, 'a'.repeat(80)],
    ];
    for (let tuple of sanitizedExecutionIdTuples) {
      expect(stepFunction.sanitizeExecutionId(tuple[0])).toBe(tuple[1]);
    }
  });
});
