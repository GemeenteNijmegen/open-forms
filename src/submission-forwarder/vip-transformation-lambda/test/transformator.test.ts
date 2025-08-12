import { randomUUID } from 'crypto';
import { VIPJZSubmissionSchema } from '../../shared/VIPJZSubmission';
import { Transformator } from '../Transformator';

const example = {
  enrichedObject: {
    pdf: 'https://example.com/open-zaak/documenten/api/v1/enkelvoudiginformatieobjecten/xxx-xxx-xxx-xxx',
    attachments: [],
    reference: 'OF-CSJ56G',
    objectUrl: 'https://example.com/objects/api/v2/objects/xxx-xxx-xxx-xxx',
    s3SubFolder: 'jz4all',
    objectUUID: 'xxx-xxx-xxx-xxx',
    bsn: '999999333',
    kvk: '',
    formName: 'Bezwaar maken',
    internalNotificationEmails: [
      'devops@nijmegen.nl',
    ],
    appId: 'JUR',
    vipZaakTypeVariable: 'bezwaarMaken',
    inlogmiddel: 'bsn',
    contactpersoon: '',
    naamContactpersoon: '',
    eMailadres: 'test@example.com',
    telefoonnummer: '',
    isgemachtigde: 'nee',
    isgemachtigde1: 'loggedin_person',
    opWelkeDatumHeeftDeGemeenteHetBesluitBekendGemaaktOfDeBeschikkingGegeven: '2025-07-01',
    welkKenmerkOfReferentienummerHeeftHetBesluitOfDeBeschikkingWaartegenUBezwaarMaakt: '123',
    naam: '',
    adres: '   ',
    kvKNummer: '',
    payment: {
      payment_completed: true,
      payment_amount: 201.1,
      payment_public_order_ids: [],
      provider_payment_ids: [],
    },
  },
  filePaths: [
    's3://bucket-name/jz4all/OF-CSJ56G/OF-CSJ56G.pdf',
  ],
  fileObjects: [
    {
      bucket: 'bucket-name',
      objectKey: 'jz4all/OF-CSJ56G/OF-CSJ56G.pdf',
      fileName: 'OF-CSJ56G.pdf',
    },
  ],
};

describe('Submission transformation', () => {

  test('Mapping', () => {
    const formData = VIPJZSubmissionSchema.parse(example.enrichedObject);
    const transformator = new Transformator(false);
    const snsmessage = transformator.convertObjectToSnsSubmission(formData, example.fileObjects, randomUUID());

    console.log(snsmessage);

    expect(snsmessage.reference).toBe('OF-CSJ56G');
    expect(snsmessage.appId).toBe('JUR');
    expect(snsmessage.bsn).toBe('999999333');
    expect(snsmessage.kvknummer).toBeUndefined();
    expect(snsmessage.data.inlogmiddel).toBeDefined();
    expect(snsmessage.data.payment).toBeUndefined(); // Should be filtered out
    expect(snsmessage.data.vipZaaktype).toBeDefined();
    expect(snsmessage.data.inlogmiddel).toBe('digid'); // mapping bsn -> digid

  });

});

describe('Payment transformation', () => {


  test('Mapping', () => {
    const formData = VIPJZSubmissionSchema.parse(example.enrichedObject);
    const transformator = new Transformator(false);
    const snsmessage = transformator.convertObjectToSnsPayment(formData, randomUUID());

    console.log(snsmessage);

    expect(snsmessage?.amount).toBe(201.1);
    expect(snsmessage?.appId).toBe('JUR-Betaling'); // -Betaling suffix should be added
    expect(snsmessage?.formTitle).toBe('bezwaarMaken');
    expect(snsmessage?.reference).toBe('OF-CSJ56G');

  });

  test('No payment data in submission', () => {
    const formData = VIPJZSubmissionSchema.parse(example.enrichedObject);
    const transformator = new Transformator(false);
    const snsmessage = transformator.convertObjectToSnsPayment({
      ...formData,
      payment: { // This is wat an empty payment looks like
        payment_amount: null,
        payment_completed: false,
        payment_public_order_ids: [],
        provider_payment_ids: [],
      },
    }, randomUUID());

    expect(snsmessage).toBeUndefined();

  });

});