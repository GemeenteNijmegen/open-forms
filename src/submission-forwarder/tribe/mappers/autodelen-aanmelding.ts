import { mapChoiceField } from './choiceField';
import { Autodelen, TribeVerzoek } from '../../shared/TribeVerzoek';
import { AUTODELEN_CONTACT_MET_ANDEREN_IDS, AUTODELEN_HOE_GEVONDEN_IDS, AUTODELEN_SITUATIE_IDS, AUTODELEN_TRIBE_FIELDS } from '../constants/autodelen';

/** Objecttype value -> Tribe record ID. */
const SITUATIE_VALUE_TO_ID: Record<string, string> = {
  begonnen: AUTODELEN_SITUATIE_IDS.BEGONNEN,
  benieuwd: AUTODELEN_SITUATIE_IDS.BENIEUWD,
  weetNogNietHoe: AUTODELEN_SITUATIE_IDS.WEET_NOG_NIET_HOE,
  inEenCooperatie: AUTODELEN_SITUATIE_IDS.IN_EEN_COOPERATIE,
  metHulpVanEenAanbieder: AUTODELEN_SITUATIE_IDS.MET_HULP_VAN_EEN_AANBIEDER,
  metEenAutoVanIemandAnders: AUTODELEN_SITUATIE_IDS.MET_EEN_AUTO_VAN_IEMAND_ANDERS,
  ikWilAutodelenMetMijnEigenAuto: AUTODELEN_SITUATIE_IDS.IK_WIL_AUTODELEN_MET_MIJN_EIGEN_AUTO,
};

/** Objecttype value -> Tribe record ID. */
const HOE_GEVONDEN_VALUE_TO_ID: Record<string, string> = {
  viaWeekblad: AUTODELEN_HOE_GEVONDEN_IDS.VIA_WEEKBLAD,
  viaWijkkrant: AUTODELEN_HOE_GEVONDEN_IDS.VIA_WIJKKRANT,
  viaSocialeMedia: AUTODELEN_HOE_GEVONDEN_IDS.VIA_SOCIALE_MEDIA,
  viaBekenden: AUTODELEN_HOE_GEVONDEN_IDS.VIA_BEKENDEN,
  anders: AUTODELEN_HOE_GEVONDEN_IDS.ANDERS,
};

/**
 * Objecttype value -> Tribe record ID. The form currently only offers these
 * three choices, so "weet ik nog niet" (a fourth Tribe-side option) has no
 * entry here yet — add it once the form can actually send that value.
 */
const CONTACT_MET_ANDEREN_VALUE_TO_ID: Record<string, string> = {
  ja: AUTODELEN_CONTACT_MET_ANDEREN_IDS.JA,
  nee: AUTODELEN_CONTACT_MET_ANDEREN_IDS.NEE,
  neeBekenden: AUTODELEN_CONTACT_MET_ANDEREN_IDS.NEE_BEKENDEN,
};

/** Objecttype field -> Tribe property, 1:1 text fields. */
const TEXT_FIELDS: Array<[string, string]> = [
  ['voornaam', AUTODELEN_TRIBE_FIELDS.VOORNAAM],
  ['tussenvoegsel', AUTODELEN_TRIBE_FIELDS.TUSSENVOEGSEL],
  ['achternaam', AUTODELEN_TRIBE_FIELDS.ACHTERNAAM],
  ['postcode', AUTODELEN_TRIBE_FIELDS.POSTCODE],
  ['emailadres', AUTODELEN_TRIBE_FIELDS.EMAILADRES],
  ['telefoonnummer', AUTODELEN_TRIBE_FIELDS.TELEFOONNUMMER],
  ['toelichtingSituatie', AUTODELEN_TRIBE_FIELDS.TOELICHTING_SITUATIE],
  ['andereOpmerkingen', AUTODELEN_TRIBE_FIELDS.ANDERE_OPMERKINGEN],
  ['toelichtingHoeGevonden', AUTODELEN_TRIBE_FIELDS.ANDERS_GEVONDEN_TOELICHTING],
  ['contactVoorkeur', AUTODELEN_TRIBE_FIELDS.CONTACTVOORKEUR],
];

/** Objecttype field -> [Tribe property, value-to-ID table], choice fields. */
const CHOICE_FIELDS: Array<[string, string, Record<string, string>]> = [
  ['situatie', AUTODELEN_TRIBE_FIELDS.SITUATIE, SITUATIE_VALUE_TO_ID],
  ['hoeGevonden', AUTODELEN_TRIBE_FIELDS.HOE_GEVONDEN, HOE_GEVONDEN_VALUE_TO_ID],
  ['contactMetAnderen', AUTODELEN_TRIBE_FIELDS.CONTACT_MET_ANDEREN, CONTACT_MET_ANDEREN_VALUE_TO_ID],
];

function mapTextField(value: string | null | undefined): string | undefined {
  return value === null || value === undefined || value === '' ? undefined : value;
}

export interface AutodelenAanmeldingContext {
  reference: string;
}

/**
 * Pure mapping from `TribeVerzoek.autodelen` to the Tribe form payload
 * (property keys from AUTODELEN_TRIBE_FIELDS). No network calls, no secrets,
 * no logging — empty/missing optional fields are left out rather than sent
 * as an empty string.
 *
 * Note: the Tribe consent text shown for the `contactMetAnderen` value "ja"
 * hasn't been confirmed to match what the form promises the user — that's a
 * functional/legal question to resolve separately, not something this
 * mapping needs to block on technically.
 */
export function mapAutodelenAanmelding(
  request: TribeVerzoek,
  context: AutodelenAanmeldingContext,
): Record<string, unknown> {
  const autodelen = request.autodelen ?? {};
  const payload: Record<string, unknown> = {};

  for (const [key, fieldId] of TEXT_FIELDS) {
    const mapped = mapTextField(autodelen[key as keyof Autodelen] as string | null | undefined);
    if (mapped !== undefined) {
      payload[fieldId] = mapped;
    }
  }

  for (const [key, fieldId, valueToId] of CHOICE_FIELDS) {
    const mapped = mapChoiceField(autodelen[key as keyof Autodelen] as string | null | undefined, valueToId, {
      reference: context.reference,
      fieldName: key,
    });
    if (mapped !== undefined) {
      payload[fieldId] = mapped;
    }
  }

  const mappedReference = mapTextField(request.reference);
  if (mappedReference !== undefined) {
    payload[AUTODELEN_TRIBE_FIELDS.OPEN_FORMULIEREN_REFERENTIE] = mappedReference;
  }

  return payload;
}
