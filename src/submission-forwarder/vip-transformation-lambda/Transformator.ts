import { randomUUID } from 'crypto';
import { PaymentSnsMessage } from './PaymentMessage';
import { zaaktypeConfig } from './VipZaakTypeConfig';
import { VIPJZSubmission } from '../shared/VIPJZSubmission';


export class Transformator {

  constructor(
    private readonly isProduction: boolean,
  ) {
    // Nothing to do here
  }

  convertObjectToSnsSubmission(formData: VIPJZSubmission, fileObjects: any) {

    // Obtain zaaktype config
    const thisZaaktypeConfig = zaaktypeConfig.find(config => config.zaaktypeVariable == formData.vipZaakTypeVariable);
    if (!thisZaaktypeConfig) {
      throw Error('Could not find zaaktype configuration for: ' + formData.vipZaakTypeVariable);
    }

    const submissionSnsMessage = {
      // Move these field to the root level of the submission.
      bsn: formData.bsn || undefined,
      kvknummer: formData.kvk || undefined,
      reference: formData.reference,
      appId: thisZaaktypeConfig.appId,
      // Move all otherfields to the submission's data field
      data: {
        ...formData,
        payment: undefined, // Send in separate message
        internalNotificationEmails: undefined, // No need to pass this to vip/jz4all
        vipZaaktype: this.isProduction ? thisZaaktypeConfig.prodUUID : thisZaaktypeConfig.accUUID,
        // Other fields are all part of the event and depdend on the form
      },

      // All file info is moved to this field
      fileObjects: fileObjects,
    };

    return submissionSnsMessage;
  }


  convertObjectToSnsPayment(formData: VIPJZSubmission) {

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
        uuid: randomUUID(), // Just use a random uuid we have the reference to correlate.
      };
      return message;
    }

    return undefined;
  }

}

