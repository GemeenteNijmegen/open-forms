export interface ProcessingPeriod {
  /** YYYY-MM-DD, inclusive */
  from: string;
  /** YYYY-MM-DD, exclusive */
  to: string;
}

export type ProcessingPeriodInput =
  | { mode: 'PREVIOUS_DAY' }
  | { mode: 'PERIOD'; from: string; to: string };

const AMSTERDAM_TIMEZONE = 'Europe/Amsterdam';

function amsterdamDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AMSTERDAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Subtracts one calendar day from a YYYY-MM-DD string. Operates on the date components
 * directly (not on a fixed 24h offset), since a Dutch calendar day can be 23 or 25 real
 * hours long around a DST transition.
 */
function previousCalendarDay(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

export function resolveProcessingPeriod(input: ProcessingPeriodInput, now: Date = new Date()): ProcessingPeriod {
  if (input.mode === 'PERIOD') {
    return { from: input.from, to: input.to };
  }
  const today = amsterdamDateString(now);
  return { from: previousCalendarDay(today), to: today };
}

/**
 * The exact UTC instant of Amsterdam midnight for a YYYY-MM-DD date, DST-aware. Needed to compare
 * a period boundary against a real timestamp (e.g. a Step Functions execution's startDate).
 */
export function amsterdamMidnightUtc(dateString: string): Date {
  // Sample the offset at the UTC-midnight probe itself, not at noon: on the spring-forward day
  // the transition happens at 01:00 UTC, so by noon the offset would already reflect the wrong
  // (post-transition) side of that same calendar day.
  const probeUtc = new Date(`${dateString}T00:00:00.000Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AMSTERDAM_TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(probeUtc);
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);
  const offsetMinutes = hour * 60 + minute;
  return new Date(probeUtc.valueOf() - offsetMinutes * 60_000);
}
