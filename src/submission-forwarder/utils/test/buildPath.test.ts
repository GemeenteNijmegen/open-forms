import { replaceForwardSlashes, createFullNetworkPath } from "../buildPath";

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


describe('createFullNetworkPath', () => {
  test.each([
    {
      networkShare: '//karelstad/webdata/Webformulieren/TEST',
      formName: 'Mijn Formulier!',
      reference: 'ABC-123',
      expected: '<\\\\karelstad\\webdata\\Webformulieren\\TEST\\MijnFormulier-ABC-123>',
    },
    {
      networkShare: '\\karelstad\\webdata\\Webformulieren\\TEST',
      formName: ' aanvraag – 2025 ',
      reference: 'OF-42',
      expected: '<\\karelstad\\webdata\\Webformulieren\\TEST\\aanvraag2025-OF-42>',
    },
    {
      networkShare: 'folder/with/mixed\\slashes',
      formName: 'Form 1',
      reference: '  99  ',
      expected: '<folder\\with\\mixed\\slashes\\Form1-  99  >',
    },
    {
      networkShare: '\\\\server\\share',
      formName: 'Inschrijvïng ✨',
      reference: 'REF',
      expected: '<\\\\server\\share\\Inschrijvng-REF>',
    },
    {
      networkShare: '\\\\server\\share',
      formName: 'Form',
      reference: '',
      expected: '<\\\\server\\share\\Form->',
    },
    {
      networkShare: 'dept/forms',
      formName: '',
      reference: 'X',
      expected: '<dept\\forms\\-X>',
    },
    {
      networkShare: '',
      formName: '__Vreemd__',
      reference: 'X',
      expected: '<\\Vreemd-X>',
    },
    {
      networkShare: '\\\\server\\share\\',
      formName: 'Doc',
      reference: '1',
      expected: '<\\\\server\\share\\\\Doc-1>',
    },
  ])(
    'share="$networkShare", form="$formName", ref="$reference"',
    ({ networkShare, formName, reference, expected }) => {
      const result = createFullNetworkPath(networkShare, formName, reference);
      expect(result).toBe(expected);
      // deterministic for same inputs
      expect(createFullNetworkPath(networkShare, formName, reference)).toBe(expected);
      if (result) console.log('createFullNetworkPath →', result);
    },
  );
});