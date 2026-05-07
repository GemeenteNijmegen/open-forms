import { getStandplaatsOpties, getStandplaatsOptiesForDate } from './standplaatsOpties';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_OPTIONS_COUNT = 4; // gemeentegrond, priveterrein, aanpassen, vervanger

// ─── Happy Path Tests ─────────────────────────────────────────────────────────

describe('getStandplaatsOptiesForDate', () => {
  describe('base options', () => {
    it('should always include the four base options', () => {
      const date = new Date('2025-06-15'); // Outside all seasonal periods
      const result = getStandplaatsOptiesForDate(date);

      expect(result.options).toHaveLength(BASE_OPTIONS_COUNT);
      expect(result.options[0]).toEqual([
        'gemeentegrond',
        'standplaatsvergunning gemeentegrond aanvragen (aan of op de openbare weg)',
      ]);
      expect(result.options[1]).toEqual([
        'priveterrein',
        'standplaatsvergunning privéterrein aanvragen (op grond die niet van de gemeente is)',
      ]);
      expect(result.options[2]).toEqual([
        'aanpassen',
        'standplaatsvergunning aanpassen of stopzetten',
      ]);
      expect(result.options[3]).toEqual([
        'vervanger',
        'vervanger standplaatsvergunning doorgeven',
      ]);
    });
  });

  describe('concert season (March 25 - May 4)', () => {
    it.each([
      [new Date('2025-03-25'), 'March 25 (start date)'],
      [new Date('2025-04-15'), 'April 15 (middle of season)'],
      [new Date('2025-05-04'), 'May 4 (end date)'],
    ])('should include concerten option on %s', (date, description) => {
      const result = getStandplaatsOptiesForDate(date);

      expect(result.options).toHaveLength(BASE_OPTIONS_COUNT + 1);
      expect(result.options).toContainEqual([
        'concerten',
        'standplaatsvergunning voor concerten aanvragen',
      ]);
    });

    it.each([
      [new Date('2025-03-24'), 'March 24 (day before)'],
      [new Date('2025-05-05'), 'May 5 (day after)'],
    ])('should NOT include concerten option on %s', (date, description) => {
      const result = getStandplaatsOptiesForDate(date);

      expect(result.options).toHaveLength(BASE_OPTIONS_COUNT);
      expect(result.options).not.toContainEqual([
        'concerten',
        'standplaatsvergunning voor concerten aanvragen',
      ]);
    });
  });

  describe('winter season (August 12 - August 27)', () => {
    it.each([
      [new Date('2025-08-12'), 'August 12 (start date)'],
      [new Date('2025-08-19'), 'August 19 (middle of season)'],
      [new Date('2025-08-27'), 'August 27 (end date)'],
    ])('should include winter option on %s', (date, description) => {
      const result = getStandplaatsOptiesForDate(date);

      expect(result.options).toHaveLength(BASE_OPTIONS_COUNT + 1);
      expect(result.options).toContainEqual([
        'winter',
        'standplaatsvergunning winterseizoen aanvragen',
      ]);
    });

    it.each([
      [new Date('2025-08-11'), 'August 11 (day before)'],
      [new Date('2025-08-28'), 'August 28 (day after)'],
    ])('should NOT include winter option on %s', (date, description) => {
      const result = getStandplaatsOptiesForDate(date);

      expect(result.options).toHaveLength(BASE_OPTIONS_COUNT);
      expect(result.options).not.toContainEqual([
        'winter',
        'standplaatsvergunning winterseizoen aanvragen',
      ]);
    });
  });

  describe('koningsdag season (January 1 - March 1)', () => {
    it.each([
      [new Date('2025-01-01'), 'January 1 (start date)'],
      [new Date('2025-01-15'), 'January 15 (middle of season)'],
      [new Date('2025-03-01'), 'March 1 (end date)'],
    ])('should include koningsdag option on %s', (date, description) => {
      const result = getStandplaatsOptiesForDate(date);

      expect(result.options).toHaveLength(BASE_OPTIONS_COUNT + 1);
      expect(result.options).toContainEqual([
        'koningsdag',
        'standplaatsvergunning Koningsdag aanvragen',
      ]);
    });

    it.each([
      [new Date('2024-12-31'), 'December 31 (day before)'],
      [new Date('2025-03-02'), 'March 2 (day after)'],
    ])('should NOT include koningsdag option on %s', (date, description) => {
      const result = getStandplaatsOptiesForDate(date);

      expect(result.options).toHaveLength(BASE_OPTIONS_COUNT);
      expect(result.options).not.toContainEqual([
        'koningsdag',
        'standplaatsvergunning Koningsdag aanvragen',
      ]);
    });
  });

  describe('multiple seasons overlapping', () => {
    it('should include koningsdag option in February', () => {
      // February 15 falls within koningsdag season (Jan 1 - Mar 1)
      const date = new Date('2025-02-15');
      const result = getStandplaatsOptiesForDate(date);

      expect(result.options).toHaveLength(BASE_OPTIONS_COUNT + 1);
      expect(result.options).toContainEqual([
        'koningsdag',
        'standplaatsvergunning Koningsdag aanvragen',
      ]);
    });
  });

  describe('outside all seasons', () => {
    it.each([
      [new Date('2025-06-01'), 'June'],
      [new Date('2025-07-15'), 'July'],
      [new Date('2025-09-01'), 'September'],
      [new Date('2025-12-25'), 'December'],
    ])('should only return base options on %s', (date, description) => {
      const result = getStandplaatsOptiesForDate(date);

      expect(result.options).toHaveLength(BASE_OPTIONS_COUNT);
    });
  });
});

describe('getStandplaatsOpties', () => {
  it('should return options based on current date', () => {
    const result = getStandplaatsOpties();

    // Should always have at least the base options
    expect(result.options.length).toBeGreaterThanOrEqual(BASE_OPTIONS_COUNT);

    // Should have first four base options
    expect(result.options[0][0]).toBe('gemeentegrond');
    expect(result.options[1][0]).toBe('priveterrein');
    expect(result.options[2][0]).toBe('aanpassen');
    expect(result.options[3][0]).toBe('vervanger');
  });
});
