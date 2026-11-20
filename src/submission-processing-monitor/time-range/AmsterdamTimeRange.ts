import type { AbsoluteTimeRange } from '../submission-log-reader/SubmissionLogReaderTypes';

const TIME_ZONE = 'Europe/Amsterdam';

/**
 * Converts a Europe/Amsterdam calendar day, midnight to midnight local time, to the range the reader accepts.
 * The day lasts 23 hours when the clock goes forward and 25 hours when it goes back.
 *
 * @param day The calendar day as 'YYYY-MM-DD', the way the Objects API writes dates.
 * @returns The range from the start of that day up to, but not including, the start of the next day.
 * @example
 * import { amsterdamCalendarDayToAbsoluteTimeRange } from '../time-range/AmsterdamTimeRange';
 * const range = amsterdamCalendarDayToAbsoluteTimeRange('2026-03-29');
 * // 2026-03-28T23:00:00Z up to 2026-03-29T22:00:00Z
 */
export function amsterdamCalendarDayToAbsoluteTimeRange(day: string): AbsoluteTimeRange {
  return {
    fromInclusive: amsterdamMidnightToUtc(day),
    toExclusive: amsterdamMidnightToUtc(nextDay(day)),
  };
}

/**
 * Lists the calendar days from firstDay up to and including lastDay, as 'YYYY-MM-DD'.
 *
 * @example
 * import { amsterdamCalendarDaysFromTo } from '../time-range/AmsterdamTimeRange';
 * const days = amsterdamCalendarDaysFromTo('2026-11-30', '2026-12-01');
 * // ['2026-11-30', '2026-12-01']
 */
export function amsterdamCalendarDaysFromTo(firstDay: string, lastDay: string): string[] {
  const days: string[] = [];
  for (let day = firstDay; day <= lastDay; day = nextDay(day)) {
    days.push(day);
  }
  return days;
}

/**
 * Gives the day before today in Europe/Amsterdam, written as the Objects API writes dates.
 * One calendar day is subtracted, not 24 hours, because a day can last 23 or 25 hours.
 *
 * @param now The moment that counts as now. Only a test passes it.
 * @returns The previous Amsterdam calendar day as 'YYYY-MM-DD'.
 * @example
 * import { previousAmsterdamCalendarDay } from '../time-range/AmsterdamTimeRange';
 * const day = previousAmsterdamCalendarDay(new Date('2026-11-18T08:00:00Z'));
 * // '2026-11-17'
 */
export function previousAmsterdamCalendarDay(now: Date = new Date()): string {
  // en-CA writes a date as YYYY-MM-DD. A date without a time is read as UTC midnight, and UTC has no daylight saving time.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().slice(0, 10);
}

// A date without a time is read as UTC midnight, and UTC has no daylight saving time, so adding one day is exact.
function nextDay(day: string): string {
  const date = new Date(day);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Reads the day as if it were UTC, then subtracts the Amsterdam offset at that moment.
 * That offset is always right for midnight: the clock changes at 02:00 or 03:00, never around midnight.
 */
function amsterdamMidnightToUtc(day: string): Date {
  const guess = new Date(day);
  const offsetMinutes = amsterdamOffsetMinutesAt(guess);
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

function amsterdamOffsetMinutesAt(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value);
    }
  }

  const sameWallClockAsUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  return (sameWallClockAsUtc - instant.getTime()) / 60_000;
}
