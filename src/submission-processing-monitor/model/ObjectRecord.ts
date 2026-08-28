export type EsfStatus = 'open' | 'afgerond' | 'verwerkt' | 'gesloten';

export interface ObjectRecord {
  objectUuid: string;
  objectIndex: number;
  objectType: string;
  registrationAt: string;
  reference?: string;
  /** ESF-taak clientnummer, al beschikbaar vanaf status open, in tegenstelling tot reference die pas bij afgerond bestaat. */
  clientNumber?: string;
  esfStatus?: EsfStatus;
  expectedProcessing: boolean;
}
