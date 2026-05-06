import { TIME_REGEX, timeToSeconds } from './time';
/**
 * variables for cost calculation:
 * - watWiltUDoen -> [gemeentegrond, priveterrein, concerten, winter, koningsdag]
 * - startdatum
 * - einddatum
 * - tijdStartConcerten
 * - tijdEindeConcerten
 *
 * watWiltUDoen == koningsdag: 125.8
 * watWiltUDoen == winterseizoen: 125.8
 * watWiltUDoen == gemeentegrond AND duration (einddatum - startdatum) > P42D: 409.65
 * watWiltUDoen == (gemeentegrond or priveterrein) AND duration (einddatum - startdatum) < P42D: 125.8
 * watWiltUDoen == (gemeentegrond or priveterrein) duration (einddatum - startdatum) > P42D: 409.65
 * watWiltUDoen == gemeentegrond AND duration (einddatum - startdatum) < P42D: 125.8
 * watWiltUDoen == concert AND tijdEindeConcerten < 22:00: 125.8
 * watWiltUDoen == concert AND tijdEindeConcerten > 22:00: 284.60
 * watWiltUDoen == concert AND tijdEindeConcerten < tijdStartConcerten: 284.60
 **/

// ─── Types ───────────────────────────────────────────────────────────────────

export type WatWiltUDoen =
  | 'gemeentegrond'
  | 'priveterrein'
  | 'concerten'
  | 'winter'
  | 'koningsdag';

export interface CostCalculationInput {
  watWiltUDoen: WatWiltUDoen;
  startdatum?: Date;
  einddatum?: Date;
  tijdStartConcerten?: string; // "HH:MM" format
  tijdEindeConcerten?: string; // "HH:MM" format
}

export interface CostCalculationResult {
  cost: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COSTS = {
  STANDARD: 125.8,
  EXTENDED: 409.65,
  CONCERT_LATE: 284.6,
} as const;

const DURATION_THRESHOLD_DAYS = 42;
const CONCERT_LATE_TIME = '22:00:00';

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Returns the duration in whole days between two dates.
 * Strips time component to avoid DST-related edge cases.
 */
function getDurationInDays(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
  );
  return Math.floor((endUtc - startUtc) / msPerDay);
}

function validateTimeFormat(time: string, fieldName: string): void {
  if (!TIME_REGEX.test(time)) {
    throw new Error(
      `Invalid time format for ${fieldName}: "${time}". Expected HH:MM (00:00–23:59).`,
    );
  }
}

function validateInput(input: CostCalculationInput): void {
  if (!input?.watWiltUDoen) {
    throw new Error('watWiltUDoen is required');
  }

  const requiresDates =
    input.watWiltUDoen === 'gemeentegrond' ||
    input.watWiltUDoen === 'priveterrein';

  if (requiresDates) {
    if (!input.startdatum || !input.einddatum) {
      throw new Error('startdatum and einddatum are required');
    }
    if (input.einddatum <= input.startdatum) {
      throw new Error('einddatum must be after startdatum');
    }
  }

  if (input.watWiltUDoen === 'concerten') {
    if (!input.tijdStartConcerten) {
      throw new Error('tijdStartConcerten is required for concerten');
    }
    if (!input.tijdEindeConcerten) {
      throw new Error('tijdEindeConcerten is required for concerten');
    }
    validateTimeFormat(input.tijdStartConcerten, 'tijdStartConcerten');
    validateTimeFormat(input.tijdEindeConcerten, 'tijdEindeConcerten');
  }
}

// ─── Calculators ──────────────────────────────────────────────────────────────

function calculateLocationBased(
  startdatum: Date,
  einddatum: Date,
): CostCalculationResult {
  const durationDays = getDurationInDays(startdatum, einddatum);
  const cost = durationDays > DURATION_THRESHOLD_DAYS
    ? COSTS.EXTENDED
    : COSTS.STANDARD;
  return { cost };
}

function calculateConcerten(
  tijdStartConcerten: string,
  tijdEindeConcerten: string,
): CostCalculationResult {

  const endSeconds = timeToSeconds(tijdEindeConcerten);
  const startSeconds = timeToSeconds(tijdStartConcerten);
  const lateSeconds = timeToSeconds(CONCERT_LATE_TIME);

  const isOvernight = endSeconds < startSeconds;
  const isLate = endSeconds > lateSeconds;

  const cost = isOvernight || isLate
    ? COSTS.CONCERT_LATE
    : COSTS.STANDARD;

  return { cost };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function calculateCost(input: CostCalculationInput): number {
  validateInput(input);

  switch (input.watWiltUDoen) {
    case 'koningsdag':
    case 'winter':
      return COSTS.STANDARD;

    case 'gemeentegrond':
    case 'priveterrein':
      return calculateLocationBased(input.startdatum!, input.einddatum!).cost;

    case 'concerten':
      return calculateConcerten(
        input.tijdStartConcerten!,
        input.tijdEindeConcerten!,
      ).cost;
  }
}
