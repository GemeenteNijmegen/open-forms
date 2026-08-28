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
