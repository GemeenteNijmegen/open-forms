import { createNormalizedFolderName, normalizeKarelstad, normalizeToAlphanumericString } from '../normalizeInput';

describe('normalizeKarelstad', () => {
  // The expected test strings need escaped slashes
  // no undefined or null uses expected
  test.each<[string, string]>([
    ['//Karelstad/webdata/Webformulieren/', '//karelstad/webdata/Webformulieren/'],
    ['//karelstad/webdata/Webformulieren/', '//karelstad/webdata/Webformulieren/'],
    ['//webdata/Webformulieren/', '//webdata/Webformulieren/'],

    ['\\\\KARELSTAD\\share\\x', '\\\\karelstad\\share\\x'],
    ['\\\\KarelStad', '\\\\karelstad'],
    ['\\\\webdata\\share', '\\\\webdata\\share'],

    ['//Karelstad\\share\\x', '//karelstad\\share\\x'],
    ['\\\\KARELSTAD/webdata', '\\\\karelstad/webdata'],

    // should not replace
    ['//karelstadt/share', '//karelstadt/share'],
    ['//foo/karelstad/share', '//foo/karelstad/share'],
    ['Karelstad/webdata', 'Karelstad/webdata'],
    ['//KARELSTAD', '//karelstad'],
    ['//Karelstad', '//karelstad'],
  ])('"%s" -> "%s"', (input, expected) => {
    expect(normalizeKarelstad(input)).toBe(expected);
    expect(normalizeKarelstad(expected)).toBe(expected);
  });
});

describe('normalizeString (ASCII alphanumeric only)', () => {
  test.each<[string, string]>([
    ['Hello, World!', 'HelloWorld'],
    ['a_b-c', 'abc'],
    ['123-456', '123456'],
    ['   spaced   out   ', 'spacedout'],
    ['', ''],
    ['--__--', ''],
    //non-ASCII letters are removed by the current regex
    ['Café numéro 9', 'Cafnumro9'],
    ['中文ABC123', 'ABC123'],
  ])('"%s" -> "%s"', (input, expected) => {
    expect(normalizeToAlphanumericString(input)).toBe(expected);
    expect(normalizeToAlphanumericString(expected)).toBe(expected); // Outcome expected not changed because correct
  });
});

describe('createNormalizedFolderName', () => {
  test.each<[string, string, string]>([
    ['Mijn Form!', 'ABC-123', 'MijnForm-ABC-123'],
    [' aanvraag – 2025 ', 'REF42', 'aanvraag2025-REF42'],
    ['__raar__', '', 'raar-'],
    ['', '123', '-123'],
    ['Form 1', '  99  ', 'Form1-  99  '],
    ['Inschrijvïng ✨', 'REF', 'Inschrijvng-REF'],
  ])('("%s", "%s") -> "%s"', (formName, reference, expected) => {
    expect(createNormalizedFolderName(formName, reference)).toBe(expected);
    expect(createNormalizedFolderName(formName, reference)).toBe(expected); // Outcome expected not changed because correct
  });
});