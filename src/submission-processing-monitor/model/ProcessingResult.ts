import { EsfStatus } from './ObjectRecord';

export type ProcessingStatus =
  | 'SUCCEEDED'
  | 'MISSING'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'ABORTED'
  | 'RUNNING'
  | 'AMBIGUOUS'
  | 'INVALID_OBJECT_DATA';

export type MatchType = 'UNIQUE' | 'AMBIGUOUS' | 'MISSING';

export interface ProcessingResult {
  objectUuid: string;
  objectIndex: number;
  objectType: string;
  registrationAt: string;
  reference?: string;
  clientNumber?: string;
  esfStatus?: EsfStatus;
  status: ProcessingStatus;
  matchType?: MatchType;
  executionArn?: string;
}
