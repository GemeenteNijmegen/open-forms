import { ReportText, ReportTextInput } from './ReportText';
import { countsAsBulletList, FOOTER, formatDayInWords, joinWithOneEmptyLine, joinWithTwoEmptyLines } from './reportTextFormat';
import {
  Deviation, deviationSections, ESF_OBJECT_TYPE_NAME, explanationAndFooter, findDeviations, objectsApiFailed, reportHeader, reportSubject, UNKNOWN,
} from './reportTextParts';
import { ProcessingOutcome } from '../../matcher/SubmissionProcessingMatcher';
import { ObjectTypeTotals } from '../report/RunReport';

const NAME = 'Open Forms';

const OUTCOME_LABELS: { outcome: ProcessingOutcome; label: string }[] = [
  { outcome: 'PROCESSED', label: 'Succesvol verwerkt' },
  { outcome: 'PROCESSED_AFTER_REDRIVE', label: 'Succesvol na redrive' },
  { outcome: 'IGNORED', label: 'Bewust niet verwerkt' },
  { outcome: 'PROBLEM', label: 'Mislukt' },
  { outcome: 'IN_PROGRESS', label: 'Nog in verwerking' },
  { outcome: 'UNCERTAIN', label: 'Onzeker' },
];

const EXPLANATION = [
  'De aantallen betreffen objectversies die in de gecontroleerde periode zijn geregistreerd. Eén inzending kan meerdere versies hebben.',
  'Dit rapport bevat geen ESF-taken. Hiervoor wordt een afzonderlijk rapport opgesteld.',
];

/**
 * Gives the report of the regular submissions of a run: every object type except esfTaak.
 *
 * The counts come from report.totals, the deviations from the versions in notOkSubmissionHistories that were registered in the period and have an
 * outcome from OUTCOMES_TO_REPORT. When the Objects API failed, the report holds only the warning.
 *
 * @param input The report of the run, the submission histories of its notOkObjectUuids and the name of the environment.
 * @returns The subject and the plain text body, as in report-text/README.md.
 * @example
 * const text = submissionReportText({ report, notOkSubmissionHistories, environment: 'Productie' });
 * logger.info('Report', { runId: report.runId, subject: text.subject, body: text.body });
 */
export function submissionReportText(input: ReportTextInput): ReportText {
  const { report, environment } = input;
  const subject = reportSubject(NAME, report, environment);
  const header = reportHeader(NAME, report, environment);
  if (objectsApiFailed(report)) {
    return { subject, body: joinWithTwoEmptyLines([joinWithOneEmptyLine(header), FOOTER]) };
  }

  const totalsPerType = Object.entries(report.totals)
    .filter(([objectTypeName]) => objectTypeName !== ESF_OBJECT_TYPE_NAME)
    .sort(([a], [b]) => a.localeCompare(b));
  const summary = [...header, ...totalCounts(totalsPerType.map(([, totals]) => totals)), ...countsPerObjectType(totalsPerType)];

  const withoutEsf = input.notOkSubmissionHistories
    .filter((submissionProcessingHistory) => submissionProcessingHistory.objectTypeName !== ESF_OBJECT_TYPE_NAME);
  const deviations = deviationSections(findDeviations(report, withoutEsf), deviationFields);

  return { subject, body: joinWithTwoEmptyLines([joinWithOneEmptyLine(summary), ...deviations, explanationAndFooter(EXPLANATION)]) };
}

/**
 * The counts at the top of the regular report, added up over all object types except esfTaak.
 *
 * In: the totals per object type.
 * Out: Unieke inzendingen and Geregistreerde objectversies, then the six outcomes as a list, like '- Mislukt: 2'.
 */
function totalCounts(totalsOfTypes: ObjectTypeTotals[]): string[] {
  const sum = (count: (totals: ObjectTypeTotals) => number | undefined) => {
    return totalsOfTypes.reduce((total, totals) => total + (count(totals) ?? 0), 0);
  };
  return [
    `Unieke inzendingen: ${sum((totals) => totals.objects)}\nGeregistreerde objectversies: ${sum((totals) => totals.versions)}`,
    countsAsBulletList(OUTCOME_LABELS.map(({ outcome, label }) => [label, sum((totals) => totals[outcome])])),
  ];
}

/**
 * The section INZENDINGEN PER OBJECTTYPE.
 *
 * In: the totals per object type, alphabetically.
 * Out: the title, then a line per type like 'Submission: 180 inzendingen, 185 versies'. Nothing when there are no types.
 */
function countsPerObjectType(totalsPerType: [string, ObjectTypeTotals][]): string[] {
  if (totalsPerType.length === 0) {
    return [];
  }
  const lines = totalsPerType.map(([objectTypeName, totals]) => `${objectTypeName}: ${totals.objects} inzendingen, ${totals.versions} versies`);
  return ['INZENDINGEN PER OBJECTTYPE', lines.join('\n')];
}

/**
 * The fields of one deviation in the regular report.
 *
 * Out: Datum, Objecttype, Formulier, OF-nummer, Object-UUID and Versie. Formulier and OF-nummer are Onbekend when the receiver logged none.
 */
function deviationFields({ submissionProcessingHistory, checkedVersion }: Deviation): string[] {
  return [
    `Datum: ${formatDayInWords(checkedVersion.registrationAt)}`,
    `Objecttype: ${submissionProcessingHistory.objectTypeName}`,
    `Formulier: ${submissionProcessingHistory.formName ?? UNKNOWN}`,
    `OF-nummer: ${submissionProcessingHistory.reference ?? UNKNOWN}`,
    `Object-UUID: ${submissionProcessingHistory.objectUuid}`,
    `Versie: ${checkedVersion.index}`,
  ];
}
