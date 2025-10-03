import { VIPJZSubmission } from '../shared/VIPJZSubmission';
import { PaymentSnsMessage } from './PaymentMessage';
import { zaaktypeConfig } from './VipZaakTypeConfig';


export class Transformator {

  constructor(
    private readonly isProduction: boolean,
  ) {
    // Nothing to do here
  }

  convertObjectToSnsSubmission(formData: VIPJZSubmission, fileObjects: any, uuid: string) {

    // Obtain zaaktype config
    const thisZaaktypeConfig = zaaktypeConfig.find(config => config.zaaktypeVariable == formData.vipZaakTypeVariable);
    if (!thisZaaktypeConfig) {
      throw Error('Could not find zaaktype configuration for: ' + formData.vipZaakTypeVariable);
    }

    // map inlogmiddel veld from bsn/kvk to digid/eherkenning
    // OpenForms uses bsn/kvk values and woweb expects digid/eherkenning
    const inlogmiddelMap: Record<string, string | undefined> = {
      bsn: 'digid',
      kvk: 'eherkenning',
      unknown: undefined,
    };
    const mappedInlogmiddel = inlogmiddelMap[formData.inlogmiddel ?? 'unknown'];

    const santaizedData = this.sanatizeData(formData);

    const submissionSnsMessage = {
      // Move these field to the root level of the submission.
      bsn: formData.bsn || undefined,
      kvknummer: formData.kvk || undefined,
      reference: formData.reference,
      appId: thisZaaktypeConfig.appId,
      formId: uuid,
      // Move all otherfields to the submission's data field
      data: {
        ...santaizedData, // Data without empty strings as values
        inlogmiddel: mappedInlogmiddel, // Converted above
        payment: undefined, // Send in separate message
        internalNotificationEmails: undefined, // No need to pass this to vip/jz4all
        vipZaaktype: this.isProduction ? thisZaaktypeConfig.prodUUID : thisZaaktypeConfig.accUUID,
        // Other fields are all part of the event and depdend on the form
      },
      // All file info is moved to this field
      fileObjects: fileObjects,
    };

    /// If BSN we need the name to be in the BRP data... (fix after extensive testing)
    if (formData.bsn) {
      const naam = santaizedData.naam ?? santaizedData.name ?? santaizedData.naamIngelogdeGebruiker;
      (submissionSnsMessage as any).brpData = {
        Persoon: {
          Persoonsgegevens: {
            Naam: naam
          }
        }
      };
    }

    return submissionSnsMessage;
  }


  convertObjectToSnsPayment(formData: VIPJZSubmission, uuid: string) {

    // Obtain zaaktype config
    const thisZaaktypeConfig = zaaktypeConfig.find(config => config.zaaktypeVariable == formData.vipZaakTypeVariable);
    if (!thisZaaktypeConfig) {
      throw Error('Could not find zaaktype configuration for: ' + formData.vipZaakTypeVariable);
    }

    if (formData.payment && formData.payment.payment_amount && formData.payment.payment_completed) {
      const message: PaymentSnsMessage = {
        amount: formData.payment.payment_amount,
        appId: `${thisZaaktypeConfig.appId}-Betaling`,
        formTitle: thisZaaktypeConfig.formName,
        reference: formData.reference,
        uuid: uuid,
      };
      return message;
    }

    return undefined;
  }

  /**
   * Filters out empty string values in the data object.
   * @param data
   */
  private sanatizeData(data: Record<string, any>): Record<string, any> {
    return Object.fromEntries(Object.entries(data).filter(([_, value]) => value !== ''));
  }


}

