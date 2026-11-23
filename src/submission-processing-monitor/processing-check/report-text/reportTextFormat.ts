/**
 * How the plain text of the reports looks: dates in Dutch, titles between dashed lines, lists of counts, numbered blocks and empty lines.
 *
 * Only layout. What goes into a report is in reportTextParts and the two report functions.
 * Plain text because the same text goes to the Lambda log and the mail, and must stay readable when copied from Outlook.
 */

const DASHED_LINE = '-'.repeat(50);

/**
 * The last lines of every report: a dashed line, then the line that says the report is generated.
 */
export const FOOTER = `${DASHED_LINE}\nAutomatisch gegenereerd door Open Forms Monitoring.`;

const writtenDateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * A day as it appears in the text of a report, with the month written out.
 *
 * In: a day as the Objects API and the run report write it, '2026-11-22'.
 * Out: '22 november 2026', as in Datum: 22 november 2026.
 */
export function formatDayInWords(day: string): string {
  return writtenDateFormat.format(new Date(day));
}

/**
 * A day as it appears in the subject of the mail, short enough for the inbox.
 *
 * In: '2026-11-22'.
 * Out: '22-11-2026', as in Open Forms - Dagrapport 22-11-2026 - Productie.
 */
export function formatDayInDigits(day: string): string {
  return day.split('-').reverse().join('-');
}

/**
 * The title of a section, so it stands out in the mail.
 *
 * In: 'PROBLEMEN (2)'.
 * Out: three lines, the title between two lines of 50 dashes:
 *   --------------------------------------------------
 *   PROBLEMEN (2)
 *   --------------------------------------------------
 */
export function titleBetweenDashedLines(title: string): string {
  return `${DASHED_LINE}\n${title}\n${DASHED_LINE}`;
}

/**
 * A list of counts, one per line, like the outcomes or the ESF statuses at the top of a report.
 *
 * In: [['Mislukt', 2], ['Onzeker', 0]].
 * Out: one line per count:
 *   - Mislukt: 2
 *   - Onzeker: 0
 */
export function countsAsBulletList(counts: [string, number][]): string {
  return counts.map(([label, count]) => `- ${label}: ${count}`).join('\n');
}

/**
 * Counts on one line, like the count per code under the title of a section.
 *
 * In: [['EXECUTION_FAILED', 1], ['OBJECT_FETCH_FAILED', 2]].
 * Out: 'EXECUTION_FAILED: 1, OBJECT_FETCH_FAILED: 2'.
 */
export function countsOnOneLine(counts: [string, number][]): string {
  return counts.map(([label, count]) => `${label}: ${count}`).join(', ');
}

/**
 * One numbered deviation in a section, with its fields indented under the title.
 *
 * In: 1, 'EXECUTION_FAILED' and ['Datum: 22 november 2026', 'Versie: 1'].
 * Out: the numbered title, an empty line, and each field indented by three spaces:
 *   1. EXECUTION_FAILED
 *
 *      Datum: 22 november 2026
 *      Versie: 1
 */
export function numberedBlockWithIndentedFields(number: number, title: string, fields: string[]): string {
  return `${number}. ${title}\n\n${fields.map((field) => `   ${field}`).join('\n')}`;
}

/**
 * The paragraphs within a section, one empty line apart.
 *
 * In: ['Unieke inzendingen: 290', 'INZENDINGEN PER OBJECTTYPE'].
 * Out: 'Unieke inzendingen: 290', an empty line, 'INZENDINGEN PER OBJECTTYPE'.
 */
export function joinWithOneEmptyLine(texts: string[]): string {
  return texts.join('\n\n');
}

/**
 * The sections of a report, or the numbered deviations within a section, two empty lines apart so each block is easy to tell apart.
 *
 * In: the top of the report, the section PROBLEMEN and the section TOELICHTING.
 * Out: the three, with two empty lines between each.
 */
export function joinWithTwoEmptyLines(texts: string[]): string {
  return texts.join('\n\n\n');
}
