import { Logger } from '@aws-lambda-powertools/logger';
import { SubmissionLogEventValue, SubmissionLogField } from '../../shared/submission-logging/SubmissionLogging';
import { EnrichedZgwObjectData } from '../shared/EnrichedZgwObjectData';
import { Notification } from '../shared/Notification';
import { ZgwObject } from '../shared/ZgwObject';

interface ReceiverLogContext {
  notification?: Notification;
  zgwObject?: ZgwObject;
  enrichedObject?: EnrichedZgwObjectData;
  executionArn?: string;
  error?: unknown;
}

export function setReceiverCorrelationId(logger: Logger, requestId: string): void {
  try {
    logger.setCorrelationId(requestId);
  } catch (error) {
    reportLoggingFailure('correlation_id', error);
  }
}

export function logReceiverEvent(logger: Logger, event: SubmissionLogEventValue, context: ReceiverLogContext = {}): void {
  try {
    const { notification, zgwObject, enrichedObject, executionArn, error } = context;
    // undefined of lege string loggen is geen probleem
    logger.info(event, {
      [SubmissionLogField.EVENT]: event,
      [SubmissionLogField.OBJECT_UUID]: zgwObject?.uuid ?? enrichedObject?.objectUUID ?? objectUuidFrom(notification),
      [SubmissionLogField.OBJECT_INDEX]: zgwObject?.record.index,
      [SubmissionLogField.OBJECT_TYPE_URL]: zgwObject?.type ?? notification?.kenmerken?.objectType,
      [SubmissionLogField.REFERENCE]: enrichedObject?.reference,
      [SubmissionLogField.FORMNAME]: enrichedObject?.formName ?? zgwObject?.record.data.formName,
      [SubmissionLogField.ESF_STATUS]: esfStatusFrom(enrichedObject, zgwObject),
      [SubmissionLogField.EXECUTION_ARN]: executionArn,
      [SubmissionLogField.REASON]: errorMessage(error),
      [SubmissionLogField.RESOURCE_URL]: notification?.resourceUrl ?? zgwObject?.url ?? enrichedObject?.objectUrl,
    });
  } catch (error) {
    reportLoggingFailure(event, error);
  }
}

function reportLoggingFailure(event: string, error: unknown): void {
  try {
    console.error('Receiver structured logging failed', { event, reason: errorMessage(error) });
  } catch {
    // Last resort: logging must never affect submission processing. Hence all the catches to be sure.
  }
}

function objectUuidFrom(notification?: Notification): string | undefined {
  return notification?.resourceUrl.split('/').filter(Boolean).at(-1);
}

function errorMessage(error?: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : undefined;
}

// enrichedObject.taak staat niet in een schema (alleen aanwezig voor ESF-objecten), vandaar de cast.
function esfStatusFrom(enrichedObject?: EnrichedZgwObjectData, zgwObject?: ZgwObject): string | undefined {
  const taakStatus = (enrichedObject?.taak as { status?: unknown } | undefined)?.status;
  if (typeof taakStatus === 'string') {
    return taakStatus;
  }

  // Alleen de ruwe status gebruiken als record.data er als ESF-taak uitziet, anders loggen we het
  // status-veld van een willekeurig ander objecttype als esfStatus.
  const data = zgwObject?.record.data as { formtaak?: unknown; status?: unknown } | undefined;
  if (typeof data?.formtaak !== 'object' || data.formtaak === null) {
    return undefined;
  }
  return typeof data.status === 'string' ? data.status : undefined;
}
