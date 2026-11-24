import { ReportText, ReportTextInput } from './ReportText';
import { countsAsBulletList, FOOTER, formatDayInWords, joinWithOneEmptyLine, joinWithTwoEmptyLines } from './reportTextFormat';
import {
  Deviation, deviationSections, ESF_OBJECT_TYPE_NAME, explanationAndFooter, findDeviations, objectsApiFailed, reportHeader, reportSubject, UNKNOWN,
} from './reportTextParts';
import { ObjectTypeTotals } from '../report/RunReport';

const NAME = 'ESF';

const STATUS_LABELS: { status: string; label: string }[] = [
  { status: 'open', label: 'Open' },
  { status: 'afgerond', label: 'Afgerond' },
  { status: 'verwerkt', label: 'Verwerkt' },
  { status: 'gesloten', label: 'Gesloten' },
];

const EXPLANATION = [
  "De belangrijkste controle betreft ESF-taken met de status 'afgerond'.",
  "Alleen ESF-taken met status 'afgerond' moeten via AWS Step Functions worden afgeleverd aan de ESB-queue.",
  "De statussen 'open', 'verwerkt' en 'gesloten' worden niet doorgestuurd naar de ESB.",
  'Een succesvolle Step Functions-execution betekent dat het bericht aan de ESB-queue is afgeleverd.\n' +
    'Dit betekent niet dat het bericht vervolgens inhoudelijk door ESB is verwerkt.',
  'De ESF-statusaantallen betreffen geregistreerde objectversies in de gecontroleerde periode, niet noodzakelijk nieuw aangemaakte ESF-taken.',
];

/**
 * Gives the report of the ESF tasks of a run: only object type esfTaak.
 *
 * The counts come from report.totals.esfTaak, the deviations from the versions in notOkSubmissionHistories that were registered in the period and
 * have an outcome from OUTCOMES_TO_REPORT. When the Objects API failed, the report holds only the warning.
 *
 * @param input The report of the run, the submission histories of its notOkObjectUuids and the name of the environment.
 * @returns The subject and the plain text body, as in report-text/README.md.
 * @example
 * const text = esfReportText({ report, notOkSubmissionHistories, environment: 'Productie' });
 */
export function esfReportText(input: ReportTextInput): ReportText {
  const { report, environment } = input;
  const subject = reportSubject(NAME, report, environment);
  const header = reportHeader(NAME, report, environment);
  if (objectsApiFailed(report)) {
    return { subject, body: joinWithTwoEmptyLines([joinWithOneEmptyLine(header), FOOTER]) };
  }

  const totals = report.totals[ESF_OBJECT_TYPE_NAME] ?? { objects: 0, versions: 0 };
  const summary = [
    ...header,
    `Unieke ESF-taken: ${totals.objects}\nGeregistreerde objectversies: ${totals.versions}`,
    'ESF-STATUSSEN',
    statusCounts(totals.esfStatus ?? {}),
    "AFLEVERING AAN ESB (STATUS 'AFGEROND')",
    deliveryCounts(totals),
  ];

  const onlyEsf = input.notOkSubmissionHistories
    .filter((submissionProcessingHistory) => submissionProcessingHistory.objectTypeName === ESF_OBJECT_TYPE_NAME);
  const deviations = deviationSections(findDeviations(report, onlyEsf), deviationFields);

  return { subject, body: joinWithTwoEmptyLines([joinWithOneEmptyLine(summary), ...deviations, explanationAndFooter(EXPLANATION)]) };
}

/**
 * The section ESF-STATUSSEN.
 *
 * In: the number of versions per esfStatus, like { open: 20, afgerond: 8 }.
 * Out: the four known statuses, also when the count is 0, like '- Open: 20'; then any status the monitor does not know, under its own name.
 */
function statusCounts(esfStatus: Record<string, number>): string {
  const knownStatuses = STATUS_LABELS.map(({ status }) => status);
  const unknownStatuses = Object.keys(esfStatus).filter((status) => !knownStatuses.includes(status)).sort();
  return countsAsBulletList([
    ...STATUS_LABELS.map(({ status, label }): [string, number] => [label, esfStatus[status] ?? 0]),
    ...unknownStatuses.map((status): [string, number] => [status, esfStatus[status]]),
  ]);
}

/**
 * The section AFLEVERING AAN ESB: what happened to the afgerond versions.
 *
 * Open, verwerkt and gesloten are IGNORED and are not counted here. A version with an unknown status is UNCERTAIN, so it counts as Onzeker.
 * Out: Succesvol afgeleverd (also after a redrive), Aflevering mislukt, Nog in verwerking and Onzeker.
 */
function deliveryCounts(totals: ObjectTypeTotals): string {
  return countsAsBulletList([
    ['Succesvol afgeleverd', (totals.PROCESSED ?? 0) + (totals.PROCESSED_AFTER_REDRIVE ?? 0)],
    ['Aflevering mislukt', totals.PROBLEM ?? 0],
    ['Nog in verwerking', totals.IN_PROGRESS ?? 0],
    ['Onzeker', totals.UNCERTAIN ?? 0],
  ]);
}

/**
 * The fields of one deviation in the ESF report.
 *
 * Out: Datum, OF-nummer, Object-UUID, Versie and ESF-status. No Objecttype and Formulier: those are the same for every ESF task.
 */
function deviationFields({ submissionProcessingHistory, checkedVersion }: Deviation): string[] {
  return [
    `Datum: ${formatDayInWords(checkedVersion.registrationAt)}`,
    `OF-nummer: ${submissionProcessingHistory.reference ?? UNKNOWN}`,
    `Object-UUID: ${submissionProcessingHistory.objectUuid}`,
    `Versie: ${checkedVersion.index}`,
    `ESF-status: ${checkedVersion.esfStatus ?? UNKNOWN}`,
  ];
}
