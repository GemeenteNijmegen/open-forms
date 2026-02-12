import { ApiClient } from '@gemeentenijmegen/apiclient';
import { APIGatewayProxyResult } from 'aws-lambda';
import { handlePrefillRequest } from './handlePrefillRequest';
import { PrefillRequest, PrefillRequestSchema } from './PrefillRequest';

const apiClient = new ApiClient();

export async function handler(event: any): Promise<APIGatewayProxyResult> {
  if (process.env.LOG_LEVEL == 'DEBUG') {
    console.debug(JSON.stringify(event, null, 4));
  }
  try {
    const prefillRequest = getPrefillRequestFromBody(event);
    const filteredRequest = retainOnlyBsnOrKvk(prefillRequest);
    return await handlePrefillRequest(filteredRequest, { apiClient });
  } catch (Error) {
    console.error('[prefill.lambda handler] Error handling prefill: ', Error);
    return {
      statusCode: 500,
      body: '',
    };
  }
}

export function getPrefillRequestFromBody(event: any): PrefillRequest {
  if (!event.body) { throw Error('[prefill lambda getPrefillRequestFromBody] No body found'); }

  try {
    const body = PrefillRequestSchema.parse(JSON.parse(event.body));
    return body;
  } catch (err: any) {
    console.error('[prefill lambda getPrefillRequestFromBody] Invalid request body:', err.message ?? err);
    throw new Error(`[prefill lambda getPrefillRequestFromBody] Invalid request body: ${err.message ?? err}`);
  }
}
export function retainOnlyBsnOrKvk(request: PrefillRequest): PrefillRequest {
  // handlePrefillRequest only expects 'bsn' or 'kvk'.
  const filteredIdentification = request.identification.filter(item =>
    item.attributeType === 'bsn' || item.attributeType === 'kvk',
  );
  // Throw an error if no 'bsn' or 'kvk' is found. Without either handlePrefill will fail anyway.
  if (filteredIdentification.length === 0) {
    console.error('[prefill.lambda retainOnlyBsnOrKvk] No bsn or kvk found in the request identification');
    throw new Error('[prefill.lambda retainOnlyBsnOrKvk] Invalid request: No bsn or kvk provided');
  }
  // Take only the first 'bsn' or 'kvk' from the filtered list.
  const uniqueIdentification = filteredIdentification.slice(0, 1);
  // Return a new PrefillRequest object with the filtered identification.
  return { ...request, identification: uniqueIdentification };
}