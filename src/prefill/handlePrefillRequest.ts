import { ApiClient } from '@gemeentenijmegen/apiclient';
import { Bsn } from '@gemeentenijmegen/utils/lib/Bsn';
import { AxiosInstance } from 'axios';
import { PrefillRequest } from './PrefillRequest';
import { StatusIITAndAVIForm } from './StatusIITAndAVIForm';


export interface prefillProps {
  formName: string;
  apiClient: ApiClient;
  axiosInstance?: AxiosInstance;
}

export interface PrefillHandler {
  requestData(identifier: Bsn|string, userType: 'person'|'organisation'): Promise<any>;
}

/**
 * Store the mapping of formNames to handler classes
 */
export const routeMapping: Record<string, {
  prefillHandler: new (props: prefillProps) => PrefillHandler;
  usesDigid: boolean;
  usesEherkenning: boolean;
}> = {
  individueleinkomenstoeslagaanvragen: {
    prefillHandler: StatusIITAndAVIForm,
    usesDigid: true,
    usesEherkenning: false,
  }
};

export interface requestHandlerProps {
  apiClient: ApiClient;
  axiosInstance?: AxiosInstance;
}

export async function handlePrefillRequest(prefillRequest: PrefillRequest, props: requestHandlerProps) {

  let bsn: Bsn | undefined = undefined;
  let kvk: string | undefined = undefined;
  const digidUsed = prefillRequest.authenticationType == 'digid';

  if (digidUsed) {
    const bsnField = prefillRequest.identification.find((attribute: any) => attribute.attributeType == 'bsn');
    if (bsnField) {
      bsn = new Bsn(bsnField.value);
    }
  }

  const eherkenningUsed = prefillRequest.authenticationType == 'eherkenning';

  if (eherkenningUsed) {
    const kvkField = prefillRequest.identification.find((attribute: any) => attribute.attributeType == 'kvk');
    if (kvkField) {
      kvk = kvkField.value;
    }
  }

  /**
   * Now we can do our normal form specific prefill
   */
  let formPrefillData = undefined;
  const handlerRecord = routeMapping[prefillRequest.formName];
  if (handlerRecord) {
    const prefillHandler = handlerRecord.prefillHandler;
    const formulier = new prefillHandler({ ...props, formName: prefillRequest.formName });

    if (handlerRecord.usesDigid && digidUsed && bsn != undefined) {
      formPrefillData = await formulier.requestData(bsn, 'person');
    } else if (handlerRecord.usesEherkenning && eherkenningUsed && kvk != undefined) {
      formPrefillData = await formulier.requestData(kvk, 'organisation');
    }
  }

  if (process.env.DEBUG == 'true') {
    console.debug('formPrefillData', JSON.stringify(formPrefillData, null, 4));
  }

  if (!formPrefillData) {
    return response(JSON.stringify({ status: 'Not handled' }), 400);
  }

  return response(JSON.stringify(formPrefillData));
}

function response(body: string, status: number = 200) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  };
}
