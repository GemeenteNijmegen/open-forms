import { EsfStatus } from '../model/ObjectRecord';

const ESF_STATUSES: EsfStatus[] = ['open', 'afgerond', 'verwerkt', 'gesloten'];

export interface EsfClassification {
  esfStatus: EsfStatus;
  /** Only afgerond ESF taken are expected to have gone through the submission-forwarder. */
  expectedProcessing: boolean;
}

/** Returns undefined if data.status is missing or not one of the known ESF statuses. */
export function classifyEsfTaak(data: Record<string, unknown>): EsfClassification | undefined {
  const status = data.status;
  if (typeof status !== 'string' || !ESF_STATUSES.includes(status as EsfStatus)) {
    return undefined;
  }
  return { esfStatus: status as EsfStatus, expectedProcessing: status === 'afgerond' };
}
