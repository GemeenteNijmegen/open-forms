const TIME_ZONE = 'Europe/Amsterdam';

/**
 * fromInclusive is part of the range, toExclusive is not. Both are absolute timestamps; the
 * reader itself does not convert timezones or calendar days.
 *
 * Example: fromInclusive = 2026-01-01T00:00:00Z, toExclusive = 2026-01-02T00:00:00Z matches
 * everything from that midnight up to, but not including, the next one. An event logged exactly
 * at 2026-01-02T00:00:00Z falls outside this range.
 *
 * Might be important when a group of logs is just around the ranges edges. Part in, part out.
 */
export interface AbsoluteTimeRange {
  fromInclusive: Date;
  toExclusive: Date;
}

export interface AmsterdamCalendarDay {
  year: number;

  // 1-12, not the 0-11 JavaScript Date convention.
  month: number;

  day: number;
}

/**
 * Converts a local Europe/Amsterdam calendar day (midnight to midnight, local time) to the
 * AbsoluteTimeRange the reader accepts. Never ambiguous: midnight itself never falls in the one
 * skipped or doubled hour a DST transition produces, those happen at 02:00/03:00 local.
 */
export function amsterdamCalendarDayToAbsoluteTimeRange(day: AmsterdamCalendarDay): AbsoluteTimeRange {
  return {
    fromInclusive: amsterdamMidnightToUtc(day),
    toExclusive: amsterdamMidnightToUtc(nextDay(day)),
  };
}

/**
 * new Date(...) normalizes an out-of-range day/month (day 32, month 13, ...) into the correct next
 * calendar date, including month and year boundaries; no separate leap year/month-length logic needed.
 */
function nextDay(day: AmsterdamCalendarDay): AmsterdamCalendarDay {
  const utc = new Date(Date.UTC(day.year, day.month - 1, day.day + 1));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

/**
 * Treats the calendar day's numerals as if they were already UTC to get a first-guess instant,
 * then corrects for Amsterdam's actual offset at that instant. That offset is exact for a local
 * midnight: the guess can only be off by the size of the offset itself (at most 2 hours for
 * CEST), far less than the distance from midnight to the 02:00/03:00 hour where DST transitions
 * happen, so the offset found at the guess is always the offset that actually applies at midnight.
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
