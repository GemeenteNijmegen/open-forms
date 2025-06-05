import { replaceForwardSlashes } from '../internalNotificationMail.lambda';

describe('replaceForwardSlashes', () => {
  test.each([
    {
      input: '//karelstad/webdata/Webformulieren/TEST',
      expected: '\\\\karelstad\\webdata\\Webformulieren\\TEST',
    },
    {
      input: '\\karelstad\\webdata\\Webformulieren\\TEST',
      expected: '\\karelstad\\webdata\\Webformulieren\\TEST',
    },
    {
      input: undefined,
      expected: '',
    },
    {
      input: null,
      expected: '',
    },
    {
      input: '',
      expected: '',
    },
    {
      input: 'folder/with/mixed\\slashes',
      expected: 'folder\\with\\mixed\\slashes',
    },
  ])('transforms "$input" correctly', ({ input, expected }) => {
    const result = replaceForwardSlashes(input);
    expect(result).toBe(expected);
    if (result) console.log('Test replaceForwardSlashes log for visuals', result);
  });
});


