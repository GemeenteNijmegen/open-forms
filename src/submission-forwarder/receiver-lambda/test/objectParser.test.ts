import { AanvraagSociaalDomeinSchema } from '../../shared/AanvraagSociaalDomein';
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
const aanvraagSociaalDomeinUrl = 'https://example.com/objecttypes/api/v2/objecttypes/167e0aec-e416-46fa-9868-e35f11f3f151';

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
    {
      objectTypeUrl: `${aanvraagSociaalDomeinUrl}`,
      parser: AanvraagSociaalDomeinSchema,
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


const esfTaakUuid = '6df21057-e07c-4909-8933-d70b79cfd15e';
const submissionUuid = 'd3713c2b-307c-4c07-8eaa-c2c6d75869cf';
const vipJzSubmissionUuid = '167e0aec-e416-46fa-9868-e35f11f3f151';
const aanvraagSociaalDomeinUuid = '167e0aec-e416-46fa-9868-e35f11f3f151';

describe('Parsing urls from env var', () => {
  const envStringEsfTaak = `esfTaak##${esfTaakUrl}`;
  const envStringSubmission = `submission##${submissionTaakUrl}`;
  const envStringVipJzSubmission = `vipJzSubmission##${vipJzSubmissionUrl}`;
  const envStringAanvraagSociaalDomein = `aanvraagSociaalDomein##${aanvraagSociaalDomeinUrl}`;
  const envStringAll = `${envStringEsfTaak};${envStringSubmission};${envStringVipJzSubmission};${envStringAanvraagSociaalDomein}`;

  test('Parsing the string (single)', async() => {
    const parsed = objectParser.parseObjectTypestring(envStringEsfTaak);
    expect(parsed.length).toBe(1);
    expect(parsed[0].objectTypeUrl).toBe(`${esfTaakUrl}`);
  });

  test('Parsing the string (multiple)', async() => {
    const parsed = objectParser.parseObjectTypestring(envStringAll);
    expect(parsed.length).toBe(4);
    expect(parsed[0].objectTypeUrl).toBe(`${esfTaakUrl}`);
    expect(parsed[1].objectTypeUrl).toBe(`${submissionTaakUrl}`);
    expect(parsed[2].objectTypeUrl).toBe(`${vipJzSubmissionUrl}`);
    expect(parsed[3].objectTypeUrl).toBe(`${aanvraagSociaalDomeinUrl}`);
    expect(parsed[1].parser).toBe(SubmissionSchema);
    expect(parsed[2].parser).toBe(VIPJZSubmissionSchema);
    expect(parsed[3].parser).toBe(AanvraagSociaalDomeinSchema);
  });

  describe('UUID-only format', () => {
    test('Parsing a UUID-only string (single)', () => {
      const parsed = objectParser.parseObjectTypestring(`esfTaak##${esfTaakUuid}`);
      expect(parsed.length).toBe(1);
      expect(parsed[0].objectTypeUrl).toBe(esfTaakUuid);
    });

    test('Parsing a UUID-only string (multiple)', () => {
      const uuidEnvString = `esfTaak##${esfTaakUuid};submission##${submissionUuid};vipJzSubmission##${vipJzSubmissionUuid};aanvraagSociaalDomein##${aanvraagSociaalDomeinUuid}`;
      const parsed = objectParser.parseObjectTypestring(uuidEnvString);
      expect(parsed.length).toBe(4);
      expect(parsed[0].objectTypeUrl).toBe(esfTaakUuid);
      expect(parsed[1].objectTypeUrl).toBe(submissionUuid);
    });
  });
});

describe('UUID-only object type matching', () => {
  let uuidObjectParser: ObjectParser;

  beforeAll(() => {
    uuidObjectParser = new ObjectParser([
      { objectTypeUrl: submissionUuid, parser: SubmissionSchema },
      { objectTypeUrl: esfTaakUuid, parser: EsfTaakSchema },
      { objectTypeUrl: vipJzSubmissionUuid, parser: VIPJZSubmissionSchema },
      { objectTypeUrl: aanvraagSociaalDomeinUuid, parser: AanvraagSociaalDomeinSchema },
    ]);
  });

  test('Matches submission by UUID even when object.type is a URL', () => {
    expect(uuidObjectParser.parse(submission)).toBeTruthy();
  });

  test('Matches taak by UUID even when object.type is a URL', () => {
    expect(uuidObjectParser.parse(taak)).toBeTruthy();
  });

  test('Matches vipjz by UUID even when object.type is a URL', () => {
    expect(uuidObjectParser.parse(vipjzVerzoek)).toBeTruthy();
  });

  test('Unknown object still throws', () => {
    expect(() => uuidObjectParser.parse(randomObject)).toThrow();
  });

  test('UUID config matches object.type regardless of domain (domain migration)', () => {
    const modifiedSubmission = structuredClone(submission);
    (modifiedSubmission as any).type = `https://new-domain.example.com/objecttypes/api/v2/objecttypes/${submissionUuid}`;
    expect(uuidObjectParser.parse(modifiedSubmission as any)).toBeTruthy();
  });

  test('UUID config from env var string matches object', () => {
    const parser = new ObjectParser(`esfTaak##${esfTaakUuid};submission##${submissionUuid};vipJzSubmission##${vipJzSubmissionUuid};aanvraagSociaalDomein##${aanvraagSociaalDomeinUuid}`);
    expect(parser.parse(submission)).toBeTruthy();
    expect(parser.parse(taak)).toBeTruthy();
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