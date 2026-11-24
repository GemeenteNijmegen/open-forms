import { ReportText, ReportTextInput } from '../../ReportText';

// One sample file is the outcome of one run, and the two reports it must give.
export interface ReportScenario {
  description: string;
  input: ReportTextInput;
  expected: {
    submissionReport: ReportText;
    esfReport: ReportText;
  };
}
