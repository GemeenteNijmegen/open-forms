// costCalculation.test.ts

import { calculateCost, CostCalculationInput } from './costCalculation';

const shortStart = new Date('2025-01-01');
const shortEnd = new Date('2025-01-31'); // 30 days
const longStart = new Date('2025-01-01');
const longEnd = new Date('2025-03-01'); // 59 days

// ─── Happy Path: Parameterized Tests ─────────────────────────────────────────

describe('calculateCost - happy path', () => {

  describe('koningsdag', () => {
    it.each([
      [
        'returns 125.80 for koningsdag',
        {
          watWiltUDoen: 'koningsdag',
        } as CostCalculationInput,
        125.8,
      ],
    ])('%s', (_, input, expected) => {
      expect(calculateCost(input)).toBe(expected);
    });
  });

  describe('winterseizoen', () => {
    it.each([
      [
        'returns 125.80 for winter',
        {
          watWiltUDoen: 'winter',
        } as CostCalculationInput,
        125.8,
      ],
    ])('%s', (_, input, expected) => {
      expect(calculateCost(input)).toBe(expected);
    });
  });

  describe('gemeentegrond', () => {
    it.each([
      [
        'returns 125.80 when duration < 42 days',
        {
          watWiltUDoen: 'gemeentegrond',
          startdatum: shortStart,
          einddatum: shortEnd,
        } as CostCalculationInput,
        125.8,
      ],
      [
        'returns 409.65 when duration > 42 days',
        {
          watWiltUDoen: 'gemeentegrond',
          startdatum: longStart,
          einddatum: longEnd,
        } as CostCalculationInput,
        409.65,
      ],
    ])('%s', (_, input, expected) => {
      expect(calculateCost(input)).toBe(expected);
    });
  });

  describe('priveterrein', () => {
    it.each([
      [
        'returns 125.80 when duration < 42 days',
        {
          watWiltUDoen: 'priveterrein',
          startdatum: shortStart,
          einddatum: shortEnd,
        } as CostCalculationInput,
        125.8,
      ],
      [
        'returns 409.65 when duration > 42 days',
        {
          watWiltUDoen: 'priveterrein',
          startdatum: longStart,
          einddatum: longEnd,
        } as CostCalculationInput,
        409.65,
      ],
    ])('%s', (_, input, expected) => {
      expect(calculateCost(input)).toBe(expected);
    });
  });

  describe('concerten', () => {
    it.each([
      [
        'returns 125.80 when tijdEindeConcerten is before 22:00',
        {
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '20:00',
          tijdEindeConcerten: '21:30',
        } as CostCalculationInput,
        125.8,
      ],
      [
        'returns 125.80 when tijdEindeConcerten is exactly 22:00',
        {
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '20:00',
          tijdEindeConcerten: '22:00',
        } as CostCalculationInput,
        125.8,
      ],
      [
        'returns 284.60 when tijdEindeConcerten is after 22:00',
        {
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '20:00',
          tijdEindeConcerten: '23:00',
        } as CostCalculationInput,
        284.6,
      ],
      [
        'returns 284.60 when tijdEindeConcerten is before tijdStartConcerten (overnight)',
        {
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '23:00',
          tijdEindeConcerten: '01:00',
        } as CostCalculationInput,
        284.6,
      ],
    ])('%s', (_, input, expected) => {
      expect(calculateCost(input)).toBe(expected);
    });
  });
});

// ─── Boundary Conditions ─────────────────────────────────────────────────────

describe('calculateCost - boundary conditions', () => {
  it.each([
    [
      'gemeentegrond: exactly 42 days is treated as not exceeding (< P42D path)',
      {
        watWiltUDoen: 'gemeentegrond',
        startdatum: new Date('2025-01-01'),
        einddatum: new Date('2025-02-12'), // exactly 42 days
      } as CostCalculationInput,
      125.8, // adjust to 409.65 if implementation uses >= 42
    ],
    [
      'priveterrein: exactly 42 days is treated as not exceeding (< P42D path)',
      {
        watWiltUDoen: 'priveterrein',
        startdatum: new Date('2025-01-01'),
        einddatum: new Date('2025-02-12'),
      } as CostCalculationInput,
      125.8, // adjust to 409.65 if implementation uses >= 42
    ],
    [
      'concerten: tijdEindeConcerten exactly at 22:00 is treated as not late',
      {
        watWiltUDoen: 'concerten',
        tijdStartConcerten: '20:00',
        tijdEindeConcerten: '22:00',
      } as CostCalculationInput,
      125.8, // adjust if implementation uses >= 22:00
    ],
  ])('%s', (_, input, expected) => {
    expect(calculateCost(input)).toBe(expected);
  });
});

// ─── Failure Modes ────────────────────────────────────────────────────────────

describe('calculateCost - failure modes', () => {
  it.each([
    [
      'throws when watWiltUDoen is missing',
      {} as CostCalculationInput,
      'watWiltUDoen is required',
    ],
    [
      'throws when gemeentegrond is missing startdatum',
      {
        watWiltUDoen: 'gemeentegrond',
        einddatum: shortEnd,
      } as CostCalculationInput,
      'startdatum and einddatum are required',
    ],
    [
      'throws when gemeentegrond is missing einddatum',
      {
        watWiltUDoen: 'gemeentegrond',
        startdatum: shortStart,
      } as CostCalculationInput,
      'startdatum and einddatum are required',
    ],
    [
      'throws when priveterrein is missing startdatum',
      {
        watWiltUDoen: 'priveterrein',
        einddatum: shortEnd,
      } as CostCalculationInput,
      'startdatum and einddatum are required',
    ],
    [
      'throws when einddatum is before startdatum',
      {
        watWiltUDoen: 'gemeentegrond',
        startdatum: shortEnd, // reversed intentionally
        einddatum: shortStart,
      } as CostCalculationInput,
      'einddatum must be after startdatum',
    ],
    [
      'throws when concerten is missing tijdEindeConcerten',
      {
        watWiltUDoen: 'concerten',
        tijdStartConcerten: '20:00',
      } as CostCalculationInput,
      'tijdEindeConcerten is required for concerten',
    ],
    [
      'throws when concerten is missing tijdStartConcerten',
      {
        watWiltUDoen: 'concerten',
        tijdEindeConcerten: '21:00',
      } as CostCalculationInput,
      'tijdStartConcerten is required for concerten',
    ],
    [
      'throws when tijdEindeConcerten has invalid format',
      {
        watWiltUDoen: 'concerten',
        tijdStartConcerten: '20:00',
        tijdEindeConcerten: '25:99', // invalid time
      } as CostCalculationInput,
      'Invalid time format',
    ],
    [
      'throws when startdatum equals einddatum (zero duration)',
      {
        watWiltUDoen: 'gemeentegrond',
        startdatum: shortStart,
        einddatum: shortStart,
      } as CostCalculationInput,
      'einddatum must be after startdatum',
    ],
  ])('%s', (_, input, expectedError) => {
    expect(() => calculateCost(input)).toThrow(expectedError);
  });
});
