export type EsfStatus = 'open' | 'afgerond' | 'verwerkt' | 'gesloten';

/** Identity of a record, from the configured object type - never derived from esfStatus, which can be missing/invalid. */
export type ProcessingKind = 'REGULAR' | 'ESF';

export interface ObjectRecord {
  objectUuid: string;
  objectIndex: number;
  objectType: string;
  processingKind: ProcessingKind;
  registrationAt: string;
  reference?: string;
  /** ESF-taak clientnummer, al beschikbaar vanaf status open, in tegenstelling tot reference die pas bij afgerond bestaat. */
  clientNumber?: string;
  esfStatus?: EsfStatus;
  expectedProcessing: boolean;
  /** False when the record's data couldn't be classified reliably, e.g. an ESF taak with a missing or unknown status. */
  dataValid: boolean;
}
