import { RunReport } from '../report/RunReport';
import { SubmissionProcessingHistory } from '../store/SubmissionProcessingHistory';

export interface ReportTextInput {
  report: RunReport;
  // From getSubmissionHistory for each of report.notOkObjectUuids. The report shows only their versions registered in the period.
  notOkSubmissionHistories: SubmissionProcessingHistory[];
  // As it appears in the subject and the header, like Productie.
  environment: string;
}

// The same text goes to the log and the mail.
export interface ReportText {
  subject: string;
  body: string;
}
