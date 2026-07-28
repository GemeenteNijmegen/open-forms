import * as tribeVerzoekFixture from '../../../receiver-lambda/test/samples/tribeVerzoek.json';
import { TribeVerzoek } from '../../../shared/TribeVerzoek';
import { AUTODELEN_CONTACT_MET_ANDEREN_IDS, AUTODELEN_HOE_GEVONDEN_IDS, AUTODELEN_SITUATIE_IDS, AUTODELEN_TRIBE_FIELDS } from '../../constants/autodelen';
import { MappingError } from '../../errors/ErrorTypes';
import { mapAutodelenAanmelding } from '../autodelen-aanmelding';

const reference = 'OF-TEST123';
const fixtureRequest = tribeVerzoekFixture.record.data as unknown as TribeVerzoek;

describe('mapAutodelenAanmelding', () => {
  test('maps the full fixture, including contactMetAnderen', () => {
    const payload = mapAutodelenAanmelding(fixtureRequest, { reference });

    expect(payload[AUTODELEN_TRIBE_FIELDS.VOORNAAM]).toBe('Jan');
    expect(payload[AUTODELEN_TRIBE_FIELDS.ACHTERNAAM]).toBe('Jansen');
    expect(payload[AUTODELEN_TRIBE_FIELDS.POSTCODE]).toBe('1234 AB');
    expect(payload[AUTODELEN_TRIBE_FIELDS.EMAILADRES]).toBe('jan.jansen@example.com');
    expect(payload[AUTODELEN_TRIBE_FIELDS.TELEFOONNUMMER]).toBe('0612345678');
    expect(payload[AUTODELEN_TRIBE_FIELDS.SITUATIE]).toEqual({ ID: AUTODELEN_SITUATIE_IDS.BENIEUWD });
    expect(payload[AUTODELEN_TRIBE_FIELDS.HOE_GEVONDEN]).toEqual({ ID: AUTODELEN_HOE_GEVONDEN_IDS.VIA_SOCIALE_MEDIA });
    expect(payload[AUTODELEN_TRIBE_FIELDS.CONTACT_MET_ANDEREN]).toEqual({ ID: AUTODELEN_CONTACT_MET_ANDEREN_IDS.NEE_BEKENDEN });
    expect(payload[AUTODELEN_TRIBE_FIELDS.CONTACTVOORKEUR]).toBe('telefonisch');
    expect(payload[AUTODELEN_TRIBE_FIELDS.OPEN_FORMULIEREN_REFERENTIE]).toBe(fixtureRequest.reference);
    // fixture has null tussenvoegsel and empty toelichtingHoeGevonden/andereOpmerkingen -> omitted
    expect(payload).not.toHaveProperty(AUTODELEN_TRIBE_FIELDS.TUSSENVOEGSEL);
    expect(payload).not.toHaveProperty(AUTODELEN_TRIBE_FIELDS.ANDERS_GEVONDEN_TOELICHTING);
    expect(payload).not.toHaveProperty(AUTODELEN_TRIBE_FIELDS.ANDERE_OPMERKINGEN);
  });

  test('minimal fixture (no autodelen object at all) still maps the Tribe referentieproperty from the top-level reference', () => {
    const request: TribeVerzoek = {
      pdf: 'https://example.com/doc',
      reference,
      attachments: [],
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
    };
    expect(mapAutodelenAanmelding(request, { reference })).toEqual({
      [AUTODELEN_TRIBE_FIELDS.OPEN_FORMULIEREN_REFERENTIE]: reference,
    });
  });

  test('empty autodelen object still maps the Tribe referentieproperty from the top-level reference', () => {
    const request: TribeVerzoek = {
      pdf: 'https://example.com/doc',
      reference,
      attachments: [],
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
      autodelen: {},
    };
    expect(mapAutodelenAanmelding(request, { reference })).toEqual({
      [AUTODELEN_TRIBE_FIELDS.OPEN_FORMULIEREN_REFERENTIE]: reference,
    });
  });

  test('contactVoorkeur maps to its Tribe property', () => {
    const request: TribeVerzoek = {
      pdf: 'https://example.com/doc',
      reference,
      attachments: [],
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
      autodelen: { contactVoorkeur: 'e-mail' },
    };
    const payload = mapAutodelenAanmelding(request, { reference });
    expect(payload[AUTODELEN_TRIBE_FIELDS.CONTACTVOORKEUR]).toBe('e-mail');
  });

  test('null and empty-string contactVoorkeur are omitted, not sent as empty values', () => {
    const request: TribeVerzoek = {
      pdf: 'https://example.com/doc',
      reference,
      attachments: [],
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
      autodelen: { contactVoorkeur: null },
    };
    const payload = mapAutodelenAanmelding(request, { reference });
    expect(payload).not.toHaveProperty(AUTODELEN_TRIBE_FIELDS.CONTACTVOORKEUR);
  });

  test('an empty top-level reference is omitted from the Tribe payload, not sent as an empty value', () => {
    const request: TribeVerzoek = {
      pdf: 'https://example.com/doc',
      reference: '',
      attachments: [],
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
    };
    const payload = mapAutodelenAanmelding(request, { reference: '' });
    expect(payload).not.toHaveProperty(AUTODELEN_TRIBE_FIELDS.OPEN_FORMULIEREN_REFERENTIE);
  });

  test('only email filled in (no phone) results in only the email key', () => {
    const request: TribeVerzoek = {
      pdf: 'https://example.com/doc',
      reference,
      attachments: [],
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
      autodelen: { emailadres: 'iemand@example.com', telefoonnummer: '' },
    };
    const payload = mapAutodelenAanmelding(request, { reference });
    expect(payload[AUTODELEN_TRIBE_FIELDS.EMAILADRES]).toBe('iemand@example.com');
    expect(payload).not.toHaveProperty(AUTODELEN_TRIBE_FIELDS.TELEFOONNUMMER);
  });

  test('only phone filled in (no email) results in only the phone key', () => {
    const request: TribeVerzoek = {
      pdf: 'https://example.com/doc',
      reference,
      attachments: [],
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
      autodelen: { telefoonnummer: '0612345678', emailadres: null },
    };
    const payload = mapAutodelenAanmelding(request, { reference });
    expect(payload[AUTODELEN_TRIBE_FIELDS.TELEFOONNUMMER]).toBe('0612345678');
    expect(payload).not.toHaveProperty(AUTODELEN_TRIBE_FIELDS.EMAILADRES);
  });

  test.each([
    ['begonnen', AUTODELEN_SITUATIE_IDS.BEGONNEN],
    ['benieuwd', AUTODELEN_SITUATIE_IDS.BENIEUWD],
    ['weetNogNietHoe', AUTODELEN_SITUATIE_IDS.WEET_NOG_NIET_HOE],
    ['inEenCooperatie', AUTODELEN_SITUATIE_IDS.IN_EEN_COOPERATIE],
    ['metHulpVanEenAanbieder', AUTODELEN_SITUATIE_IDS.MET_HULP_VAN_EEN_AANBIEDER],
    ['metEenAutoVanIemandAnders', AUTODELEN_SITUATIE_IDS.MET_EEN_AUTO_VAN_IEMAND_ANDERS],
    ['ikWilAutodelenMetMijnEigenAuto', AUTODELEN_SITUATIE_IDS.IK_WIL_AUTODELEN_MET_MIJN_EIGEN_AUTO],
  ])('maps every known situatie value (%s)', (value, id) => {
    const request: TribeVerzoek = {
      pdf: 'https://example.com/doc',
      reference,
      attachments: [],
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
      autodelen: { situatie: value },
    };
    const payload = mapAutodelenAanmelding(request, { reference });
    expect(payload[AUTODELEN_TRIBE_FIELDS.SITUATIE]).toEqual({ ID: id });
  });

  test.each([
    ['ja', AUTODELEN_CONTACT_MET_ANDEREN_IDS.JA],
    ['nee', AUTODELEN_CONTACT_MET_ANDEREN_IDS.NEE],
    ['neeBekenden', AUTODELEN_CONTACT_MET_ANDEREN_IDS.NEE_BEKENDEN],
  ])('maps every known contactMetAnderen value (%s)', (value, id) => {
    const request: TribeVerzoek = {
      pdf: 'https://example.com/doc',
      reference,
      attachments: [],
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
      autodelen: { contactMetAnderen: value },
    };
    const payload = mapAutodelenAanmelding(request, { reference });
    expect(payload[AUTODELEN_TRIBE_FIELDS.CONTACT_MET_ANDEREN]).toEqual({ ID: id });
  });

  test('an unknown, non-empty contactMetAnderen value throws a MappingError (e.g. the Tribe-only "weet ik nog niet" option)', () => {
    const request: TribeVerzoek = {
      pdf: 'https://example.com/doc',
      reference,
      attachments: [],
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
      autodelen: { contactMetAnderen: 'weetIkNogNiet' },
    };
    expect(() => mapAutodelenAanmelding(request, { reference })).toThrow(MappingError);
  });

  test('empty contactMetAnderen is omitted, not mapped', () => {
    const request: TribeVerzoek = {
      pdf: 'https://example.com/doc',
      reference,
      attachments: [],
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
      autodelen: { contactMetAnderen: '' },
    };
    const payload = mapAutodelenAanmelding(request, { reference });
    expect(payload).not.toHaveProperty(AUTODELEN_TRIBE_FIELDS.CONTACT_MET_ANDEREN);
  });

  test('anders with a clarification includes both the choice and the clarification text', () => {
    const request: TribeVerzoek = {
      pdf: 'https://example.com/doc',
      reference,
      attachments: [],
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
      autodelen: { hoeGevonden: 'anders', toelichtingHoeGevonden: 'Via een folder' },
    };
    const payload = mapAutodelenAanmelding(request, { reference });
    expect(payload[AUTODELEN_TRIBE_FIELDS.HOE_GEVONDEN]).toEqual({ ID: AUTODELEN_HOE_GEVONDEN_IDS.ANDERS });
    expect(payload[AUTODELEN_TRIBE_FIELDS.ANDERS_GEVONDEN_TOELICHTING]).toBe('Via een folder');
  });

  test('anders without a clarification only includes the choice', () => {
    const request: TribeVerzoek = {
      pdf: 'https://example.com/doc',
      reference,
      attachments: [],
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
      autodelen: { hoeGevonden: 'anders', toelichtingHoeGevonden: null },
    };
    const payload = mapAutodelenAanmelding(request, { reference });
    expect(payload[AUTODELEN_TRIBE_FIELDS.HOE_GEVONDEN]).toEqual({ ID: AUTODELEN_HOE_GEVONDEN_IDS.ANDERS });
    expect(payload).not.toHaveProperty(AUTODELEN_TRIBE_FIELDS.ANDERS_GEVONDEN_TOELICHTING);
  });

  test('an unknown, non-empty situatie value throws a MappingError', () => {
    const request: TribeVerzoek = {
      pdf: 'https://example.com/doc',
      reference,
      attachments: [],
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
      autodelen: { situatie: 'eenNogOnbekendeWaarde' },
    };
    expect(() => mapAutodelenAanmelding(request, { reference })).toThrow(MappingError);
  });

  test('null and empty-string text fields are omitted, not sent as empty values', () => {
    const request: TribeVerzoek = {
      pdf: 'https://example.com/doc',
      reference,
      attachments: [],
      tribeEnvironment: 'AUTODELEN',
      tribeSubmissionType: 'AUTODELEN_AANMELDING',
      autodelen: {
        voornaam: null,
        achternaam: '',
        postcode: undefined,
      },
    };
    const payload = mapAutodelenAanmelding(request, { reference });
    expect(payload).not.toHaveProperty(AUTODELEN_TRIBE_FIELDS.VOORNAAM);
    expect(payload).not.toHaveProperty(AUTODELEN_TRIBE_FIELDS.ACHTERNAAM);
    expect(payload).not.toHaveProperty(AUTODELEN_TRIBE_FIELDS.POSTCODE);
  });
});
