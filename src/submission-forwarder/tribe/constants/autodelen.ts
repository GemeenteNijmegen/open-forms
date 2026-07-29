/**
 * Tribe Autodelen — technical Tribe IDs behind functional names, taken from
 * the Tribe OData metamodel and datastore exports for the Autodelen form.
 * Only change these after a re-export of the Tribe form/metamodel.
 */

/** The "Aanmeldformulier autodelen" form entity. */
export const AUTODELEN_ENTITY = {
  ENTITY_TYPE: '_3881e9fc__a770__47ab__a547__091ca1bd5fc7',
  ENTITY_TYPE_ID: 49902,
} as const;

/**
 * Text and choice fields of the form. Choice fields (SITUATIE, HOE_GEVONDEN,
 * CONTACT_MET_ANDEREN) navigate to a datastore; the payload shape for those is
 * `{ [property]: { ID: <record-guid> } }`, using the matching
 * `AUTODELEN_*_IDS` map below.
 */
export const AUTODELEN_TRIBE_FIELDS = {
  VOORNAAM: 'e4d6da94__fe9d__43e8__be1f__8a359911b9a8',
  TUSSENVOEGSEL: '_4393ae03__e0a2__432d__bfb6__009f4f3138ad',
  ACHTERNAAM: '_04d904c7__9725__4563__97e9__6aeb00cfa449',
  POSTCODE: 'bfb01497__9ca8__4c9d__b562__1dd5c0093ede',
  EMAILADRES: '_3c999636__add0__44c7__91ee__e74d26a14200',
  TELEFOONNUMMER: '_36d6045c__1cca__4f48__af68__91af51f20494',
  TOELICHTING_SITUATIE: '_84a55cbb__9925__49be__9e09__da33dd726fdd',
  ANDERE_OPMERKINGEN: 'fa59cb08__d5e2__4349__8fdb__519f5ffb8e35',
  ANDERS_GEVONDEN_TOELICHTING: '_8f5cedc0__6a5f__4b79__b760__9e9632bb09f4',
  SITUATIE: 'fab54a03__2654__4a1c__8dbd__48736065db9a',
  HOE_GEVONDEN: '_3c6845d6__33e6__4d69__b340__a1706e440baf',
  CONTACT_MET_ANDEREN: '_448b0832__def2__4bdd__a624__588b2517fedc',
  CONTACTVOORKEUR: '_34490040__b10f__4fac__8e01__fe26532a88da',
  OPEN_FORMULIEREN_REFERENTIE: 'b8ab90c8__549d__4100__87bc__e19a9185b657',
} as const;

/** Datastore "Interesseniveau" — belongs to AUTODELEN_TRIBE_FIELDS.SITUATIE. */
export const AUTODELEN_SITUATIE_IDS = {
  BEGONNEN: '1144f610-2241-41a1-870f-d7c4be7cd8e1',
  BENIEUWD: '709065ab-7e79-45e0-a11c-35104e5dd87f',
  WEET_NOG_NIET_HOE: '68f21516-b91b-42aa-99f2-2ec703ed6e5b',
  IN_EEN_COOPERATIE: '59fb0058-aae5-4355-8940-2784380b95d8',
  MET_HULP_VAN_EEN_AANBIEDER: '6b2af9b9-058c-42f4-ad68-c57c0144440c',
  MET_EEN_AUTO_VAN_IEMAND_ANDERS: '8d14a191-fbf1-43fc-9ac6-7cefd7ad483d',
  IK_WIL_AUTODELEN_MET_MIJN_EIGEN_AUTO: 'f72c0ba5-1a70-4a7c-9315-5dea6d98e088',
} as const;

/** Datastore "Hoe gevonden?" — belongs to AUTODELEN_TRIBE_FIELDS.HOE_GEVONDEN. */
export const AUTODELEN_HOE_GEVONDEN_IDS = {
  VIA_WEEKBLAD: 'da920ad5-8b59-4e18-8d5d-bead5dcb3a7c',
  VIA_WIJKKRANT: '5b78c612-6791-486e-82aa-a14423a43c28',
  VIA_SOCIALE_MEDIA: '559f0cbd-e8ec-4605-ad61-b37dcbde9d93',
  VIA_BEKENDEN: '4541a0ee-fd1f-4a96-94dc-be9426312124',
  ANDERS: 'eeb9008a-be77-4b83-8aa4-1e8d818ddf8a',
} as const;

/**
 * Datastore "Contact met anderen" — belongs to
 * AUTODELEN_TRIBE_FIELDS.CONTACT_MET_ANDEREN. The mapping rule for `JA` and
 * `WEET_IK_NOG_NIET` isn't finalized yet, so the mapper doesn't use those two
 * values yet (see mappers/autodelen-aanmelding.ts). All four Tribe values are
 * listed here already so the mapper won't need a bare UUID once that's settled.
 */
export const AUTODELEN_CONTACT_MET_ANDEREN_IDS = {
  JA: '2ebe83f8-f06c-4cb8-95a2-0af2d6dad872',
  NEE_BEKENDEN: 'b2401f2a-7174-4acc-99fc-7ca18990c410',
  NEE: '82ff2bf9-5ed7-437c-873f-dc3b82444819',
  WEET_IK_NOG_NIET: 'ea97af44-4327-4ac5-b8dd-6de87bcd3119',
} as const;
