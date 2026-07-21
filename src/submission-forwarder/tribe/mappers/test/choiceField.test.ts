import { MappingError } from '../../errors/ErrorTypes';
import { mapChoiceField } from '../choiceField';

const idsByValue = {
  begonnen: '1144f610-2241-41a1-870f-d7c4be7cd8e1',
  benieuwd: '709065ab-7e79-45e0-a11c-35104e5dd87f',
};
const context = { reference: 'OF-TEST123', fieldName: 'situatie' };

describe('mapChoiceField', () => {
  test('returns undefined for null', () => {
    expect(mapChoiceField(null, idsByValue, context)).toBeUndefined();
  });

  test('returns undefined for undefined', () => {
    expect(mapChoiceField(undefined, idsByValue, context)).toBeUndefined();
  });

  test('returns undefined for empty string', () => {
    expect(mapChoiceField('', idsByValue, context)).toBeUndefined();
  });

  test('returns the Tribe ID wrapper for a known value', () => {
    expect(mapChoiceField('begonnen', idsByValue, context)).toEqual({ ID: idsByValue.begonnen });
  });

  test('throws a MappingError for an unknown, non-empty value', () => {
    expect(() => mapChoiceField('onbekendeWaarde', idsByValue, context)).toThrow(MappingError);
  });

  test('error message contains the reference and field name, not the full payload', () => {
    try {
      mapChoiceField('onbekendeWaarde', idsByValue, context);
      fail('expected mapChoiceField to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(MappingError);
      expect((error as Error).message).toContain('situatie');
      expect((error as Error).message).toContain('OF-TEST123');
      expect((error as Error).message).not.toContain('onbekendeWaarde');
    }
  });
});
