import schema from '../../../schema/TribeVerzoek.json';
import {
  AUTODELEN_CONTACT_MET_ANDEREN_IDS,
  AUTODELEN_ENTITY,
  AUTODELEN_HOE_GEVONDEN_IDS,
  AUTODELEN_SITUATIE_IDS,
  AUTODELEN_TRIBE_FIELDS,
} from '../autodelen';

function values(map: Record<string, string>) {
  return Object.values(map);
}

describe('Autodelen constants', () => {
  test('entity constant is defined', () => {
    expect(AUTODELEN_ENTITY.ENTITY_TYPE).toBeTruthy();
  });

  test('every field constant has a unique, non-empty value', () => {
    const all = values(AUTODELEN_TRIBE_FIELDS);
    expect(all.length).toBe(new Set(all).size);
    all.forEach(value => expect(value.length).toBeGreaterThan(0));
  });

  test('situatie datastore has one constant per known schema example', () => {
    const schemaExamples: string[] = (schema as any).properties.autodelen.properties.situatie.examples;
    expect(Object.keys(AUTODELEN_SITUATIE_IDS).length).toBe(schemaExamples.length);
  });

  test('hoeGevonden datastore has one constant per known schema example', () => {
    const schemaExamples: string[] = (schema as any).properties.autodelen.properties.hoeGevonden.examples;
    expect(Object.keys(AUTODELEN_HOE_GEVONDEN_IDS).length).toBe(schemaExamples.length);
  });

  test('contactMetAnderen datastore covers at least every known schema example (plus the unmapped "weet ik nog niet" value)', () => {
    const schemaExamples: string[] = (schema as any).properties.autodelen.properties.contactMetAnderen.examples;
    expect(Object.keys(AUTODELEN_CONTACT_MET_ANDEREN_IDS).length).toBeGreaterThanOrEqual(schemaExamples.length);
  });

  test('no two datastores accidentally share a record ID', () => {
    const all = [
      ...values(AUTODELEN_SITUATIE_IDS),
      ...values(AUTODELEN_HOE_GEVONDEN_IDS),
      ...values(AUTODELEN_CONTACT_MET_ANDEREN_IDS),
    ];
    expect(all.length).toBe(new Set(all).size);
  });
});
