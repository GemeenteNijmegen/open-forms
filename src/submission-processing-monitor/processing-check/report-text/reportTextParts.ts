import {
  countsOnOneLine, FOOTER, formatDayInDigits, formatDayInWords, joinWithOneEmptyLine, joinWithTwoEmptyLines, numberedBlockWithIndentedFields,
  titleBetweenDashedLines,
} from './reportTextFormat';
import { ProcessingOutcome } from '../../matcher/SubmissionProcessingMatcher';
import { OUTCOMES_TO_REPORT } from '../report/findNotOkObjectUuids';
import { RunReport } from '../report/RunReport';
import { CheckedVersion, SubmissionProcessingHistory } from '../store/SubmissionProcessingHistory';

export const ESF_OBJECT_TYPE_NAME = 'esfTaak';
export const UNKNOWN = 'Onbekend';

const DEVIATION_SECTIONS: { outcome: ProcessingOutcome; title: string }[] = [
  { outcome: 'PROBLEM', title: 'PROBLEMEN' },
  { outcome: 'IN_PROGRESS', title: 'NOG IN VERWERKING' },
  { outcome: 'UNCERTAIN', title: 'ONZEKER' },
  { outcome: 'PROCESSED_AFTER_REDRIVE', title: 'SUCCESVOL NA REDRIVE' },
];

export interface Deviation {
  submissionProcessingHistory: SubmissionProcessingHistory;
  checkedVersion: CheckedVersion;
}

/**
 * The subject of the mail, with the period and the environment.
 *
 * In: the name of the report (Open Forms or ESF), the run report and the environment.
 * Out for one day: 'Open Forms - Dagrapport 22-11-2026 - Productie'.
 * Out for more days: 'ESF - Rapport 01-11-2026 t/m 03-11-2026 - Acceptatie'.
 */
export function reportSubject(name: string, report: RunReport, environment: string): string {
  const period = report.firstDay === report.lastDay
    ? `Dagrapport ${formatDayInDigits(report.firstDay)}`
    : `Rapport ${formatDayInDigits(report.firstDay)} t/m ${formatDayInDigits(report.lastDay)}`;
  return `${name} - ${period} - ${environment}`;
}

/**
 * The paragraphs at the top of a report.
 *
 * In: the name of the report (Open Forms or ESF), the run report and the environment.
 * Out: the warning when a day is not fully checked, then the title (OPEN FORMS - DAGOVERZICHT, or OVERZICHT for more days), then
 * Datum or Periode, Omgeving and Controle (Volledig uitgevoerd or Onvolledig), each on its own line.
 */
export function reportHeader(name: string, report: RunReport, environment: string): string[] {
  const oneDay = report.firstDay === report.lastDay;
  const title = `${name.toUpperCase()} - ${oneDay ? 'DAGOVERZICHT' : 'OVERZICHT'}`;
  const period = oneDay
    ? `Datum: ${formatDayInWords(report.firstDay)}`
    : `Periode: ${formatDayInWords(report.firstDay)} t/m ${formatDayInWords(report.lastDay)}`;
  const control = report.status === 'COMPLETE' ? 'Volledig uitgevoerd' : 'Onvolledig';
  return [...incompleteWarning(report), title, [period, `Omgeving: ${environment}`, `Controle: ${control}`].join('\n')];
}

/**
 * The warning that the counts are not complete, with each day that was not fully checked and why.
 *
 * In: a run report with 2 november LOGS_NOT_READ.
 * Out: LET OP: CONTROLE ONVOLLEDIG, the explanation, and '2 november 2026: LOGS_NOT_READ'. Nothing when every day is complete.
 */
function incompleteWarning(report: RunReport): string[] {
  const incompleteDays = report.days.filter((dayCheck) => dayCheck.status === 'INCOMPLETE');
  if (incompleteDays.length === 0) {
    return [];
  }
  return [
    'LET OP: CONTROLE ONVOLLEDIG',
    'Niet alle inzendingen konden worden gecontroleerd.\n' +
      'De onderstaande aantallen betreffen uitsluitend de beschikbare resultaten en kunnen onvolledig zijn.',
    incompleteDays.map((dayCheck) => `${formatDayInWords(dayCheck.day)}: ${dayCheck.reason}`).join('\n'),
  ];
}

/**
 * Whether the Objects API failed, so nothing in the period was checked.
 *
 * Then a report holds only the warning: counts of zero would look like a day without submissions.
 */
export function objectsApiFailed(report: RunReport): boolean {
  return report.days.some((dayCheck) => dayCheck.reason === 'OBJECTS_API_FAILED');
}

/**
 * The versions that go into the report as a deviation.
 *
 * In: the run report and the stored histories of its notOkObjectUuids, with all versions ever checked.
 * Out: each version registered in the period with an outcome from OUTCOMES_TO_REPORT, together with its history.
 * A version of an earlier day, or one that was PROCESSED or IGNORED, is left out.
 */
export function findDeviations(report: RunReport, notOkSubmissionHistories: SubmissionProcessingHistory[]): Deviation[] {
  const deviations: Deviation[] = [];
  for (const submissionProcessingHistory of notOkSubmissionHistories) {
    for (const checkedVersion of submissionProcessingHistory.versions) {
      const inPeriod = checkedVersion.registrationAt >= report.firstDay && checkedVersion.registrationAt <= report.lastDay;
      if (inPeriod && OUTCOMES_TO_REPORT.includes(checkedVersion.outcome)) {
        deviations.push({ submissionProcessingHistory, checkedVersion });
      }
    }
  }
  return deviations.sort(byDayThenObjectUuidThenIndex);
}

/**
 * The order of the deviations: by day, then by objectUuid, then by version.
 *
 * The same order on every run, so two reports of the same period can be compared line by line.
 */
function byDayThenObjectUuidThenIndex(a: Deviation, b: Deviation): number {
  if (a.checkedVersion.registrationAt !== b.checkedVersion.registrationAt) {
    return a.checkedVersion.registrationAt.localeCompare(b.checkedVersion.registrationAt);
  }
  if (a.submissionProcessingHistory.objectUuid !== b.submissionProcessingHistory.objectUuid) {
    return a.submissionProcessingHistory.objectUuid.localeCompare(b.submissionProcessingHistory.objectUuid);
  }
  return a.checkedVersion.index - b.checkedVersion.index;
}

/**
 * The sections with deviations, in the order PROBLEMEN, NOG IN VERWERKING, ONZEKER, SUCCESVOL NA REDRIVE.
 *
 * In: the deviations, and the fields to show per deviation (these differ between the regular and the ESF report).
 * Out: per section the title with the number of deviations, the count per code, and the numbered deviations.
 * A section without deviations is left out.
 */
export function deviationSections(deviations: Deviation[], fieldsOf: (deviation: Deviation) => string[]): string[] {
  return DEVIATION_SECTIONS.flatMap(({ outcome, title }) => {
    const deviationsOfSection = deviations.filter((deviation) => deviation.checkedVersion.outcome === outcome);
    if (deviationsOfSection.length === 0) {
      return [];
    }
    const numbered = deviationsOfSection.map((deviation, i) => numberedBlockWithIndentedFields(i + 1, deviationCode(deviation), fieldsOf(deviation)));
    const sectionTitle = titleBetweenDashedLines(`${title} (${deviationsOfSection.length})`);
    return [joinWithOneEmptyLine([sectionTitle, countPerCode(deviationsOfSection), joinWithTwoEmptyLines(numbered)])];
  });
}

/**
 * The end of a report.
 *
 * In: the paragraphs that explain the counts of this report.
 * Out: the title TOELICHTING, the paragraphs and the footer.
 */
export function explanationAndFooter(paragraphs: string[]): string {
  return joinWithOneEmptyLine([titleBetweenDashedLines('TOELICHTING'), ...paragraphs, FOOTER]);
}

/**
 * The title of one deviation.
 *
 * Out: the reason of the matcher, like EXECUTION_FAILED, or the outcome for IN_PROGRESS and PROCESSED_AFTER_REDRIVE, which have no reason.
 */
function deviationCode(deviation: Deviation): string {
  return deviation.checkedVersion.reason ?? deviation.checkedVersion.outcome;
}

/**
 * How often each code occurs in a section, so you see at once whether it is one cause.
 *
 * In: the deviations of one section.
 * Out: 'EXECUTION_FAILED: 1, OBJECT_FETCH_FAILED: 2', the codes alphabetically.
 */
function countPerCode(deviations: Deviation[]): string {
  const counts = new Map<string, number>();
  for (const deviation of deviations) {
    const code = deviationCode(deviation);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return countsOnOneLine([...counts].sort(([a], [b]) => a.localeCompare(b)));
}
