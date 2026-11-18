import type { AbsoluteTimeRange } from '../submission-log-reader/SubmissionLogReaderTypes';

const TIME_ZONE = 'Europe/Amsterdam';

export interface AmsterdamCalendarDay {
  year: number;

  // 1-12, not the 0-11 JavaScript Date convention.
  month: number;

  day: number;
}

/**
 * Converts a Europe/Amsterdam calendar day, midnight to midnight local time, to the range the reader accepts.
 * The day lasts 23 hours when the clock goes forward and 25 hours when it goes back.
 *
 * @param day The calendar day. The month is 1-12.
 * @returns The range from the start of that day up to, but not including, the start of the next day.
 * @example
 * import { amsterdamCalendarDayToAbsoluteTimeRange } from '../time-range/AmsterdamTimeRange';
 * const range = amsterdamCalendarDayToAbsoluteTimeRange({ year: 2026, month: 3, day: 29 });
 * // 2026-03-28T23:00:00Z up to 2026-03-29T22:00:00Z
 */
export function amsterdamCalendarDayToAbsoluteTimeRange(day: AmsterdamCalendarDay): AbsoluteTimeRange {
  return {
    fromInclusive: amsterdamMidnightToUtc(day),
    toExclusive: amsterdamMidnightToUtc(nextDay(day)),
  };
}

// Date.UTC turns day 32 or month 13 into the next month or year, leap years included.
function nextDay(day: AmsterdamCalendarDay): AmsterdamCalendarDay {
  const utc = new Date(Date.UTC(day.year, day.month - 1, day.day + 1));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

/**
 * Reads the day as if it were UTC, then subtracts the Amsterdam offset at that moment.
 * That offset is always right for midnight: the clock changes at 02:00 or 03:00, never around midnight.
 */
function amsterdamMidnightToUtc(day: AmsterdamCalendarDay): Date {
  const guess = new Date(Date.UTC(day.year, day.month - 1, day.day));
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
