import { EsfTaakSchema } from '../../shared/EsfTaak';
import { SubmissionSchema } from '../../shared/Submission';
import { ObjectParser } from '../ObjectParser';
import * as taak from './samples/esfTaak.json';
import * as randomObject from './samples/randomObject.json';
import * as submission from './samples/submission.json';

const esfTaakUrl = 'https://example.com/objecttypes/api/v2/objecttypes/6df21057-e07c-4909-8933-d70b79cfd15e';
const submissionTaakUrl = 'https://example.com/objecttypes/api/v2/objecttypes/d3713c2b-307c-4c07-8eaa-c2c6d75869cf';

let objectParser: ObjectParser;
beforeAll(() => {
  const objectTypes = [
    {
      objectTypeUrl: submissionTaakUrl,
      parser: SubmissionSchema,
    },
    {
      objectTypeUrl: `${esfTaakUrl}`,
      parser: EsfTaakSchema,
    },
  ];
  objectParser = new ObjectParser(objectTypes);
});

describe('Parsing for the next step', () => {
  test('Parsing a taak object succeeds', async () => {
    expect(objectParser.parse(taak)).toBeTruthy();
  });
  test('Parsing a submission object succeeds', async () => {
    expect(objectParser.parse(submission)).toBeTruthy();
  });

  test('Parsing an unknown object throws', async () => {
    expect(() => { objectParser.parse(randomObject); }).toThrow();
  });
});


describe('Parsing urls from env var', () => {
  const envStringEsfTaak = `esfTaak##${esfTaakUrl}`;
  const envStringSubmission = `submission##${submissionTaakUrl}`;
  const envStringBoth = `${envStringEsfTaak};${envStringSubmission}`;

  test('Parsing the string (single)', async() => {
    const parsed = objectParser.parseObjectTypestring(envStringEsfTaak);
    expect(parsed.length).toBe(1);
    expect(parsed[0].objectTypeUrl).toBe(`${esfTaakUrl}`);
  });

  test('Parsing the string (multiple)', async() => {
    const parsed = objectParser.parseObjectTypestring(envStringBoth);
    expect(parsed.length).toBe(2);
    expect(parsed[0].objectTypeUrl).toBe(`${esfTaakUrl}`);
    expect(parsed[1].objectTypeUrl).toBe(`${submissionTaakUrl}`);
    expect(parsed[1].parser).toBe(SubmissionSchema);
  });
});
