import * as taak from './samples/esfTaak.json';
import { EsfTaakSchema } from '../../shared/EsfTaak';
import { ObjectSchema } from '../../shared/ZgwObject';
test('parses objects', async() => {
  expect(ObjectSchema.parse(taak)).toBeTruthy();
});

test('parses taak in objects', async() => {
  const object = ObjectSchema.parse(taak);
  console.debug(object.record.data);
  expect(EsfTaakSchema.parse(object.record.data)).toBeTruthy();
});
