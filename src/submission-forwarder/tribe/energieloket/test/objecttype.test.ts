import alleVelden from './samples/alle-velden.json';
import inwoner from './samples/inwoner.json';
import vve from './samples/vve.json';
import { TribeVerzoekSchema } from '../../../shared/TribeVerzoek';

describe('Energieloket in TribeVerzoek', () => {
  test.each([
    ['formulier inwoner', inwoner],
    ['formulier VvE', vve],
    ['alle velden', alleVelden],
  ])('%s wordt ongewijzigd geaccepteerd', (_name, sample) => {
    expect(TribeVerzoekSchema.parse(sample)).toEqual(sample);
  });
});
