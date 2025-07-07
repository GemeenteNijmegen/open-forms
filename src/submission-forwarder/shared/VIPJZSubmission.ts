import { z } from 'zod';
import { PaymentSchema } from './Payment';

export const VIPJZSubmissionSchema = z
  .object({
    bsn: z
      .string()
      .optional()
      .describe(
        'BSN wanneer het formulier ingevuld is met Digid of Yivi met BSN. Ook met vipkeys bij apvBlok1A, apvBlok2A, apvblok1New, beheerderExploitatievergunningHorecaZonderAlcoholAanpassen, leidinggevendeAlcoholvergunningAanpassen, terrasvergunningAanvragenOfAanpassen, objectvergunningAanvragenNew, alcoholvergunningAanvragen, toestemmingVragenTijdelijkAlcoholSchenken, kansspelautomaatAanwezigheidsvergunningAanvragen; metadata: vip_key=bsn',
      ),
    kvk: z
      .string()
      .optional()
      .describe(
        'KvK-nummer wanneer het formulier ingevuld is met Eherkenning of Yivi met KvK. Ook met vipkeys apvblok1New; metadata: vip_key=kvk',
      ),
    pdf: z
      .string()
      .describe('pdf url'),
    formName: z
      .string()
      .optional()
      .describe('productaanvraag type'),
    reference: z
      .string()
      .describe('submission public reference.'),
    attachments: z
      .array(z.string())
      .describe('Bijlage urls'),
    internalNotificationEmails: z
      .array(z.string().email())
      .optional()
      .default([])
      .describe(
        'Email addresses of internal employees or departments to notify when a new submission arrives.',
      ),
    appId: z
      .enum([
        'APV',
        'APV-Taak',
        'APV-Betaling',
        'JUR',
        'JUR-Taak',
        'JUR-Betaling',
      ])
      .optional()
      .describe(
        'VIP en JZ4All hebben nog steeds het appId nodig in de submission en als message attribute.',
      ),
    vipZaakTypeVariable: z
      .enum([
        'beheerderHorecaZonderAlcoholAanpassenSeks',
        'beheerderHorecaZonderAlcoholAanpassenDefault',
        'terrasVergunningDefault',
        'toestemmingTijdelijkAlcoholSchenken',
        'leidingAlcoholVergunningAanpassen',
        'exploitatieVergunningAanvragen',
        'objectVergunningAanvragen',
        'alcoholVergunningAanvragen',
        'kansspelAutomaatAanwezigheid',
        'bezwaarMaken',
        'evenementMeldenVoetbal',
        'evenementMeldenNeeRegels',
        'evenementMeldenDefault',
        'klachtGemeenteDoorgeven',
        'klachtIetsAnders',
        'standplaatsGemeentegrond',
        'standplaatsPriveterrein',
        'standplaatsWinter',
        'standplaatsKoningsdag',
        'standplaatsConcerten',
        'standplaatsVervanger',
        'standplaatsAanpassen',
        'openingstijdenOntheffing',
        'marktplaatsAanpassen',
        'marktplaatsVervanger',
        'marktplaatsDefault',
        'informatiekraamMelden',
        'datumReserverenEvenement',
        'bingoBingoKienen',
        'bingoDefault',
        'kraamPodiumVierdaagse',
        'toestemmingVervoerGevaarlijk',
        'themamarktVergunning',
        'customUUID',
      ])
      .optional()
      .describe(
        "Must be one of the zaaktypeVariable values from configuration. If customUUID is chosen, the code will try to extract the uuid from 'customZaakTypeUUID'",
      ),
    customZaakTypeUUID: z
      .string()
      .optional()
      .describe(
        'Only works when customUUID is gekozen in vipZaakTypeVariable. Voor snel testen zonder schema-wijziging.',
      ),

    inlogmiddel: z
      .string()
      .optional()
      .describe(
        'apvBlok1A, apvBlok2A, apvblok1New, beheerderExploitatievergunningHorecaZonderAlcoholAanpassen, leidinggevendeAlcoholvergunningAanpassen, terrasvergunningAanvragenOfAanpassen, objectvergunningAanvragenNew, standplaatsAanvragenOfAanpassen, alcoholvergunningAanvragen, toestemmingVragenTijdelijkAlcoholSchenken, bezwaarMakenNieuw, rxmissiontestr01, kansspelautomaatAanwezigheidsvergunningAanvragen, klachtOverIetsAndersNieuw; metadata: vip_key=inlogmiddel, jz4all_key=inlogmiddel',
      ),
    naamOrganisatieOfBedrijf: z
      .string()
      .optional()
      .describe(
        'apvBlok1A, apvBlok2A, apvblok1New, beheerderExploitatievergunningHorecaZonderAlcoholAanpassen, leidinggevendeAlcoholvergunningAanpassen, terrasvergunningAanvragenOfAanpassen, objectvergunningAanvragenNew; metadata: vip_key=business_name, dms_key=initiator.niet_natuurlijk_persoon.statutaireNaam',
      ),
    inschrijfnummerKamerVanKoophandel: z
      .string()
      .optional()
      .describe(
        'apvBlok1A, apvBlok2A, apvblok1New, beheerderExploitatievergunningHorecaZonderAlcoholAanpassen, leidinggevendeAlcoholvergunningAanpassen, terrasvergunningAanvragenOfAanpassen, objectvergunningAanvragenNew, kansspelautomaatAanwezigheidsvergunningAanvragen; metadata: vip_key=kvk',
      ),
    contactpersoon: z
      .string()
      .optional()
      .describe(
        'apvBlok1A, apvBlok2A, apvblok1New, bezwaarMakenNieuw; metadata: vip_key=initiator_is_contact, jz4all_key=initiator_is_contact',
      ),
    naamContactpersoon: z
      .string()
      .optional()
      .describe(
        'apvBlok1A, apvBlok2A, apvblok1New, beheerderExploitatievergunningHorecaZonderAlcoholAanpassen, leidinggevendeAlcoholvergunningAanpassen, terrasvergunningAanvragenOfAanpassen, objectvergunningAanvragenNew, bezwaarMakenNieuw, kansspelautomaatAanwezigheidsvergunningAanvragen; metadata: vip_key=name, jz4all_key=contact.naam',
      ),
    eMailadres: z
      .string()
      .optional()
      .describe(
        'apvBlok1A, apvBlok2A, apvblok1New, beheerderExploitatievergunningHorecaZonderAlcoholAanpassen, leidinggevendeAlcoholvergunningAanpassen, terrasvergunningAanvragenOfAanpassen, objectvergunningAanvragenNew, bezwaarMakenNieuw, klachtOverDeGemeenteDoorgevenNieuw, rxmissiontestr01, kansspelautomaatAanwezigheidsvergunningAanvragen, klachtOverIetsAndersNieuw; metadata: vip_key=email, jz4all_key=email',
      ),
    telefoonnummer: z
      .string()
      .optional()
      .describe(
        'apvBlok1A, apvBlok2A, apvblok1New, beheerderExploitatievergunningHorecaZonderAlcoholAanpassen, leidinggevendeAlcoholvergunningAanpassen, terrasvergunningAanvragenOfAanpassen, objectvergunningAanvragenNew, bezwaarMakenNieuw, klachtOverDeGemeenteDoorgevenNieuw, kansspelautomaatAanwezigheidsvergunningAanvragen, klachtOverIetsAndersNieuw; metadata: vip_key=phone, jz4all_key=phone',
      ),
    telefoonnummer1: z
      .string()
      .optional()
      .describe(
        'apvblok1New, terrasvergunningAanvragenOfAanpassen; metadata: vip_key=phone',
      ),
    eMailadres1: z
      .string()
      .optional()
      .describe(
        'apvblok1New, beheerderExploitatievergunningHorecaZonderAlcoholAanpassen, leidinggevendeAlcoholvergunningAanpassen, terrasvergunningAanvragenOfAanpassen, bezwaarMakenNieuw, rxmissiontestr01, kansspelautomaatAanwezigheidsvergunningAanvragen; metadata: vip_key=email, jz4all_key=email',
      ),
    naamIngelogdeGebruiker: z
      .string()
      .optional()
      .describe(
        'beheerderExploitatievergunningHorecaZonderAlcoholAanpassen, terrasvergunningAanvragenOfAanpassen, objectvergunningAanvragenNew, vergunningAanvragenKraamPodiumLangsRouteVierdaagse, themamarktVergunningAanvragen, toestemmingVervoerGevaarlijkeStoffenAanvragen, bingoMeldenOfLoterijvergunningAanvragen, datumReserverenEvenementNew1, evenementenMeldenOfVergunningAanvragen, ontheffingOpeningstijdenWinkelAanvragen, marktplaatsvergunningAanvragenOfAanpassen, standplaatsAanvragenOfAanpassen, alcoholvergunningAanvragen, toestemmingVragenTijdelijkAlcoholSchenken, apvOntheffingVervoerGevaarlijkeStoffenAanvragen, kansspelautomaatAanwezigheidsvergunningAanvragen; metadata: vip_key=name',
      ),
    totaalbedrag: z
      .string()
      .optional()
      .describe(
        'beheerderExploitatievergunningHorecaZonderAlcoholAanpassen, leidinggevendeAlcoholvergunningAanpassen, terrasvergunningAanvragenOfAanpassen, themamarktVergunningAanvragen, toestemmingVervoerGevaarlijkeStoffenAanvragen, informatiekraamMeldenOfVergunningAanvragen, bingoMeldenOfLoterijvergunningAanvragen, ontheffingOpeningstijdenWinkelAanvragen, marktplaatsvergunningAanvragenOfAanpassen, standplaatsAanvragenOfAanpassen, toestemmingVragenTijdelijkAlcoholSchenken, apvOntheffingVervoerGevaarlijkeStoffenAanvragen; metadata: vip_key=payment',
      ),
    naamIngelogdeGebruiker1: z
      .string()
      .optional()
      .describe(
        'leidinggevendeAlcoholvergunningAanpassen, exploitatievergunningAanvragen; metadata: vip_key=name',
      ),
    isgemachtigde: z
      .string()
      .optional()
      .describe(
        'bezwaarMakenNieuw, rxmissiontestr01; metadata: jz4all_key=is_authorized_person',
      ),
    isgemachtigde1: z
      .string()
      .optional()
      .describe('bezwaarMakenNieuw; metadata: jz4all_key=webform_initiator.type'),
    opWelkeDatumHeeftDeGemeenteHetBesluitBekendGemaaktOfDeBeschikkingGegeven: z
      .string()
      .optional()
      .describe(
        'bezwaarMakenNieuw; metadata: jz4all_key=datum_primair_besluit',
      ),
    welkKenmerkOfReferentienummerHeeftHetBesluitOfDeBeschikkingWaartegenUBezwaarMaakt: z
      .string()
      .optional()
      .describe(
        'bezwaarMakenNieuw; metadata: jz4all_key=primair_dossier',
      ),
    naam: z
      .string()
      .optional()
      .describe(
        'bezwaarMakenNieuw, klachtOverDeGemeenteDoorgevenNieuw, bezwaarMakenNew; metadata: jz4all_key=webform_initiator.naam, jz4all_key=naam',
      ),
    adres: z
      .string()
      .optional()
      .describe('bezwaarMakenNieuw; metadata: jz4all_key=webform_initiator.adres'),
    kvKNummer: z
      .string()
      .optional()
      .describe('bezwaarMakenNieuw; metadata: jz4all_key=webform_initiator.kvk'),
    initiatorTypeJz4All1: z
      .string()
      .optional()
      .describe('klachtOverDeGemeenteDoorgevenNieuw; metadata: jz4all_key=initiator_type'),
    naamBedrijfWaarvoorUEenVergunningAanvraagt: z
      .string()
      .optional()
      .describe(
        'kansspelautomaatAanwezigheidsvergunningAanvragen; metadata: dms_key=initiator.niet_natuurlijk_persoon.statutaireNaam',
      ),
    payment: PaymentSchema.optional().describe('Optionele betalingsgegevens'),
  });
export type VIPJZSubmission = z.infer<typeof VIPJZSubmissionSchema>;
