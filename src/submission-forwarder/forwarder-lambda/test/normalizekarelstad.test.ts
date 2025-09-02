import { normalizeKarelstad } from '../Handler';

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