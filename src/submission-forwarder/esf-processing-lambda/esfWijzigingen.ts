import { EsfTaak } from '../shared/EsfTaak';

type VerzondenData = EsfTaak['formtaak']['verzonden_data'];

const ANSWER_LABELS: [keyof VerzondenData, string][] = [
  ['inkomstengewijzigd', 'Aanpassing inkomen'],
  ['woonsituatiegewijzigd', 'Aanpassing wonen'],
  ['vakantiegewijzigd', 'Aanpassing vakantie'],
  ['studiegewijzigd', 'Aanpassing studie'],
  ['vrijwilligerswerkgewijzigd', 'Aanpassing vrijwilligerswerk'],
  ['vermogengewijzigd', 'Aanpassing vermogen'],
  ['toelichtingingevuld', 'Toelichting ingevuld'],
];

const VALUE_LABELS: Record<string, string> = {
  ja: 'Ja',
  nee: 'Nee',
  jaGestartMetStudie: 'Ja, gestart met studie',
  jaGestoptMetStudie: 'Ja, gestopt met studie',
  jaGestartMetVrijwilligerswerk: 'Ja, gestart met vrijwilligerswerk',
  jaGestoptMetVrijwilligerswerk: 'Ja, gestopt met vrijwilligerswerk',
};

/**
 * Plain-text overview for the administration of what the citizen changed
 * compared to the prefilled data, and the answers given in the form.
 */
export function esfWijzigingen(taak: EsfTaak, reference: string): string {
  const { data, verzonden_data: verzonden } = taak.formtaak;

  const lines = [
    `Wijzigingen statusformulier ${reference}`,
    `Dossiernummer: ${data.dossiernummer}`,
    `Periodenummer: ${data.periodenummer}`,
    `Clientnummer: ${data.clientnummer}`,
    '',
    ...compare('Email', data.email, verzonden.email, normalizeEmail),
    ...compare('Telefoon', data.telefoon, verzonden.telefoon, normalizeTelefoon),
    ...ANSWER_LABELS.map(([field, label]) => `${label}: ${valueLabel(verzonden[field])}`),
  ];
  return lines.join('\n') + '\n';
}

function compare(label: string, oud: string | undefined, nieuw: string | undefined, normalize: (value: string) => string) {
  if (normalize(oud ?? '') === normalize(nieuw ?? '')) {
    return [`${label}: geen wijzigingen`];
  }
  return [
    `${label}:`,
    `    oud: ${oud || '(leeg)'}`,
    `    nieuw: ${nieuw || '(leeg)'}`,
  ];
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeTelefoon(value: string) {
  return value.replace(/[\s-]/g, '');
}

function valueLabel(value: unknown) {
  const text = String(value ?? '');
  return Object.hasOwn(VALUE_LABELS, text) ? VALUE_LABELS[text] : text;
}
