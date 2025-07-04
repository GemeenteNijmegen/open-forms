import { EsfTaakSchema } from '../../shared/EsfTaak';
import { SubmissionSchema } from '../../shared/Submission';
import { VIPJZSubmissionSchema } from '../../shared/VIPJZSubmission';
import { ObjectParser } from '../ObjectParser';
import * as taak from './samples/esfTaak.json';
import * as randomObject from './samples/randomObject.json';
import * as submission from './samples/submission.json';
import * as vipjzVerzoek from './samples/vipjzVerzoek.json';

const esfTaakUrl = 'https://example.com/objecttypes/api/v2/objecttypes/6df21057-e07c-4909-8933-d70b79cfd15e';
const submissionTaakUrl = 'https://example.com/objecttypes/api/v2/objecttypes/d3713c2b-307c-4c07-8eaa-c2c6d75869cf';
const vipJzSubmissionUrl = 'https://example.com/objecttypes/api/v2/objecttypes/167e0aec-e416-46fa-9868-e35f11f3f151';

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
    {
      objectTypeUrl: `${vipJzSubmissionUrl}`,
      parser: VIPJZSubmissionSchema,
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
  test('Parsing a vipjzubmission object succeeds', async () => {
    expect(objectParser.parse(vipjzVerzoek)).toBeTruthy();
  });
  test('Parsing an unknown object throws', async () => {
    expect(() => { objectParser.parse(randomObject); }).toThrow();
  });
});


describe('Parsing urls from env var', () => {
  const envStringEsfTaak = `esfTaak##${esfTaakUrl}`;
  const envStringSubmission = `submission##${submissionTaakUrl}`;
  const envStringVipJzSubmission = `vipJzSubmission##${vipJzSubmissionUrl}`;
  const envStringAll = `${envStringEsfTaak};${envStringSubmission};${envStringVipJzSubmission}`;

  test('Parsing the string (single)', async() => {
    const parsed = objectParser.parseObjectTypestring(envStringEsfTaak);
    expect(parsed.length).toBe(1);
    expect(parsed[0].objectTypeUrl).toBe(`${esfTaakUrl}`);
  });

  test('Parsing the string (multiple)', async() => {
    const parsed = objectParser.parseObjectTypestring(envStringAll);
    expect(parsed.length).toBe(3);
    expect(parsed[0].objectTypeUrl).toBe(`${esfTaakUrl}`);
    expect(parsed[1].objectTypeUrl).toBe(`${submissionTaakUrl}`);
    expect(parsed[2].objectTypeUrl).toBe(`${vipJzSubmissionUrl}`);
    expect(parsed[1].parser).toBe(SubmissionSchema);
    expect(parsed[2].parser).toBe(VIPJZSubmissionSchema);
  });
});
describe('Adding optional s3SubFolderObject to enrichedZGWObject', () => {
  test('Parsing JUR vipjzVerzoek adds s3SubFolder', () => {
    const parsedObject = objectParser.parse(vipjzVerzoek);
    expect(parsedObject.s3SubFolder).toEqual('jz4all');
  });
  test('Parsing no appId reverts to default', () => {
    const modified = structuredClone(vipjzVerzoek);
    delete (modified.record.data as any).appId;
    const parsed = objectParser.parse(modified);
    expect(parsed.s3SubFolder).toBe('vip');
  });
  test.each([
    // '' and undefined not possible due to enum zod schema
    ['JUR', 'jz4all'],
    ['APV', 'vip'],
    ['APV-Taak', 'vip'],
    ['JUR-Betaling', 'jz4all'],
  ])(
    'Parsing vipjzVerzoek with appId=%s yields s3SubFolder=%s',
    (appId, expectedFolder) => {
      // clone no mutate
      const modified = structuredClone(vipjzVerzoek);
      modified.record.data.appId = appId;

      const parsed = objectParser.parse(modified);
      expect(parsed.s3SubFolder).toBe(expectedFolder);
    },
  );
});