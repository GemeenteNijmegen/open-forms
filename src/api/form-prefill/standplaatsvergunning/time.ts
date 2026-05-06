// Accepts HH:MM and HH:MM:SS — single source of truth for both parser and calculator
export const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/**
 * Converts "HH:MM" or "HH:MM:SS" to total seconds since midnight.
 * Using seconds as the base unit ensures HH:MM:SS comparisons are exact.
 */
export function timeToSeconds(time: string): number {
  const [hours, minutes, seconds = 0] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}
