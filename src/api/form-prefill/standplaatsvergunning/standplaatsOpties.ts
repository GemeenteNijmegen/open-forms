/**
 * Standplaats options based on current date and seasonal availability
 *
 * Always returns base options:
 * - gemeentegrond
 * - priveterrein
 * - aanpassen
 * - vervanger
 *
 * Seasonal additions:
 * - concerten: March 25 - May 4 (inclusive)
 * - winter: August 12 - August 27 (inclusive)
 * - koningsdag: January 1 - March 1 (inclusive)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type StandplaatsOption = [string, string];

export interface StandplaatsOptiesResult {
  options: StandplaatsOption[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_OPTIONS: StandplaatsOption[] = [
  [
    'gemeentegrond',
    'standplaatsvergunning gemeentegrond aanvragen (aan of op de openbare weg)',
  ],
  [
    'priveterrein',
    'standplaatsvergunning privéterrein aanvragen (op grond die niet van de gemeente is)',
  ],
  [
    'aanpassen',
    'standplaatsvergunning aanpassen of stopzetten',
  ],
  [
    'vervanger',
    'vervanger standplaatsvergunning doorgeven',
  ],
];

const SEASONAL_OPTIONS = {
  CONCERTEN: [
    'concerten',
    'standplaatsvergunning voor concerten aanvragen',
  ] as StandplaatsOption,
  WINTER: [
    'winter',
    'standplaatsvergunning winterseizoen aanvragen',
  ] as StandplaatsOption,
  KONINGSDAG: [
    'koningsdag',
    'standplaatsvergunning Koningsdag aanvragen',
  ] as StandplaatsOption,
} as const;

// ─── Date Range Helpers ──────────────────────────────────────────────────────

/**
 * Check if a given date falls within the concert season.
 * Concert season: March 25 - May 4 (inclusive)
 */
function isInConcertSeason(date: Date): boolean {
  const month = date.getMonth() + 1; // 1-indexed
  const day = date.getDate();

  return (
    (month === 3 && day >= 25) ||
    (month === 4) ||
    (month === 5 && day <= 4)
  );
}

/**
 * Check if a given date falls within the winter season.
 * Winter season: August 12 - August 27 (inclusive)
 */
function isInWinterSeason(date: Date): boolean {
  const month = date.getMonth() + 1; // 1-indexed
  const day = date.getDate();

  return month === 8 && day >= 12 && day <= 27;
}

/**
 * Check if a given date falls within the Koningsdag season.
 * Koningsdag season: January 1 - March 1 (inclusive)
 */
function isInKoningsdagSeason(date: Date): boolean {
  const month = date.getMonth() + 1; // 1-indexed
  const day = date.getDate();

  return (
    (month === 1) ||
    (month === 2) ||
    (month === 3 && day === 1)
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get available standplaats options based on the current date.
 * Includes seasonal options if the current date falls within their respective periods.
 */
export function getStandplaatsOpties(): StandplaatsOptiesResult {
  const today = new Date();
  const options: StandplaatsOption[] = [...BASE_OPTIONS];

  if (isInConcertSeason(today)) {
    options.push(SEASONAL_OPTIONS.CONCERTEN);
  }

  if (isInWinterSeason(today)) {
    options.push(SEASONAL_OPTIONS.WINTER);
  }

  if (isInKoningsdagSeason(today)) {
    options.push(SEASONAL_OPTIONS.KONINGSDAG);
  }

  return { options };
}

/**
 * Get available standplaats options for a specific date (mainly for testing).
 * Includes seasonal options if the specified date falls within their respective periods.
 */
export function getStandplaatsOptiesForDate(date: Date): StandplaatsOptiesResult {
  const options: StandplaatsOption[] = [...BASE_OPTIONS];

  if (isInConcertSeason(date)) {
    options.push(SEASONAL_OPTIONS.CONCERTEN);
  }

  if (isInWinterSeason(date)) {
    options.push(SEASONAL_OPTIONS.WINTER);
  }

  if (isInKoningsdagSeason(date)) {
    options.push(SEASONAL_OPTIONS.KONINGSDAG);
  }

  return { options };
}
