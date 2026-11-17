import { EsfTaak } from '../../shared/EsfTaak';
import { esfWijzigingen } from '../esfWijzigingen';

function taak(overrides?: {
  data?: Partial<EsfTaak['formtaak']['data']>;
  verzonden_data?: Partial<EsfTaak['formtaak']['verzonden_data']>;
}): EsfTaak {
  return {
    soort: 'formtaak',
    titel: 'Statusformulier invullen',
    status: 'afgerond',
    eigenaar: 'nijmegen',
    formtaak: {
      formulier: {
        soort: 'url',
        value: 'https://formulier.nijmegen.nl/statusformulier',
      },
      data: {
        clientnummer: '12345',
        termijnvanordedatum: '2025-07-05',
        inkhef: 'NEE',
        dossiernummer: '12345678',
        regelingnummer: '0',
        periodenummer: '202510',
        email: 'info@example.com',
        telefoon: '06123123123',
        ...overrides?.data,
      },
      verzonden_data: {
        formulierreferentie: 'OF-123456',
        email: 'info@example.com',
        telefoon: '06123123123',
        inkomstengewijzigd: 'nee',
        woonsituatiegewijzigd: 'nee',
        vakantiegewijzigd: 'nee',
        studiegewijzigd: 'nee',
        vrijwilligerswerkgewijzigd: 'nee',
        vermogengewijzigd: 'nee',
        toelichtingingevuld: 'nee',
        pdf: 'https://example.com/documenten/api/v1/enkelvoudiginformatieobjecten/1',
        attachments: [],
        ...overrides?.verzonden_data,
      },
    },
    verloopdatum: '2025-05-21 00:00:00',
    identificatie: {
      type: 'bsn',
      value: '900026236',
    },
  };
}

describe('esfWijzigingen', () => {
  test('lists all fields without changes', () => {
    expect(esfWijzigingen(taak(), 'ESF-OF-123456-12345678-202510')).toBe([
      'Wijzigingen statusformulier ESF-OF-123456-12345678-202510',
      'Dossiernummer: 12345678',
      'Periodenummer: 202510',
      'Clientnummer: 12345',
      '',
      'Email: geen wijzigingen',
      'Telefoon: geen wijzigingen',
      'Aanpassing inkomen: Nee',
      'Aanpassing wonen: Nee',
      'Aanpassing vakantie: Nee',
      'Aanpassing studie: Nee',
      'Aanpassing vrijwilligerswerk: Nee',
      'Aanpassing vermogen: Nee',
      'Toelichting ingevuld: Nee',
      '',
    ].join('\n'));
  });

  test('shows old and new value for changed contact details', () => {
    const text = esfWijzigingen(taak({
      verzonden_data: { email: 'nieuw@example.com', telefoon: '0632132131' },
    }), 'ref');
    expect(text).toContain([
      'Email:',
      '    oud: info@example.com',
      '    nieuw: nieuw@example.com',
      'Telefoon:',
      '    oud: 06123123123',
      '    nieuw: 0632132131',
    ].join('\n'));
  });

  test('ignores case and surrounding whitespace in email', () => {
    const text = esfWijzigingen(taak({
      data: { email: ' Info@Example.com ' },
    }), 'ref');
    expect(text).toContain('Email: geen wijzigingen');
  });

  test('ignores spaces and dashes in telefoon', () => {
    const text = esfWijzigingen(taak({
      data: { telefoon: '06-123 123 123' },
    }), 'ref');
    expect(text).toContain('Telefoon: geen wijzigingen');
  });

  test('shows missing prefill telefoon as empty', () => {
    const text = esfWijzigingen(taak({
      data: { telefoon: undefined },
    }), 'ref');
    expect(text).toContain([
      'Telefoon:',
      '    oud: (leeg)',
      '    nieuw: 06123123123',
    ].join('\n'));
  });

  test('shows readable labels for answers', () => {
    const text = esfWijzigingen(taak({
      verzonden_data: {
        inkomstengewijzigd: 'ja',
        studiegewijzigd: 'jaGestartMetStudie',
        vrijwilligerswerkgewijzigd: 'jaGestoptMetVrijwilligerswerk',
      },
    }), 'ref');
    expect(text).toContain('Aanpassing inkomen: Ja');
    expect(text).toContain('Aanpassing studie: Ja, gestart met studie');
    expect(text).toContain('Aanpassing vrijwilligerswerk: Ja, gestopt met vrijwilligerswerk');
  });

  test('shows missing submitted telefoon as empty', () => {
    const text = esfWijzigingen(taak({
      verzonden_data: { telefoon: '' },
    }), 'ref');
    expect(text).toContain([
      'Telefoon:',
      '    oud: 06123123123',
      '    nieuw: (leeg)',
    ].join('\n'));
  });

  test('treats telefoon missing in both prefill and submission as unchanged', () => {
    const text = esfWijzigingen(taak({
      data: { telefoon: undefined },
      verzonden_data: { telefoon: '' },
    }), 'ref');
    expect(text).toContain('Telefoon: geen wijzigingen');
  });

  test('does not label answers that match built-in object properties', () => {
    const text = esfWijzigingen(taak({
      verzonden_data: { toelichtingingevuld: 'constructor' },
    }), 'ref');
    expect(text).toContain('Toelichting ingevuld: constructor');
  });

  test('prints unknown answer values as-is', () => {
    const text = esfWijzigingen(taak({
      verzonden_data: { toelichtingingevuld: 'Ik ben verhuisd' },
    }), 'ref');
    expect(text).toContain('Toelichting ingevuld: Ik ben verhuisd');
  });
});
