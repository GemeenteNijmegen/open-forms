import { parseEvent, ParseError } from './parser';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(
  queryStringParameters: Record<string, string> | null = null,
  body: string | null = null,
  isBase64Encoded = false,
) {
  return { queryStringParameters, body, isBase64Encoded };
}

function makeBodyEvent(params: Record<string, string>) {
  return makeEvent(null, JSON.stringify(params));
}

function expectParseError(
  fn: () => unknown,
  expectedField: string,
  expectedMessageFragment?: string,
) {
  let error: unknown;
  try {
    fn();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(ParseError);
  const parseError = error as ParseError;
  const matchingIssue = parseError.issues.find(
    (i) => i.path.join('.') === expectedField,
  );
  expect(matchingIssue).toBeDefined();
  if (expectedMessageFragment !== undefined) {
    expect(matchingIssue?.message).toContain(expectedMessageFragment);
  }
}

function catchParseError(fn: () => unknown): ParseError {
  try {
    fn();
  } catch (e) {
    if (e instanceof ParseError) return e;
  }
  throw new Error('Expected a ParseError to be thrown');
}

// ─── Happy Path ───────────────────────────────────────────────────────────────

describe('parseEvent - happy path', () => {
  describe('koningsdag & winter (no extra fields needed)', () => {
    it.each<[string, ReturnType<typeof makeEvent>, string]>([
      [
        'koningsdag via query params',
        makeEvent({ watWiltUDoen: 'koningsdag' }),
        'koningsdag',
      ],
      [
        'winter via query params',
        makeEvent({ watWiltUDoen: 'winter' }),
        'winter',
      ],
      [
        'koningsdag via body',
        makeBodyEvent({ watWiltUDoen: 'koningsdag' }),
        'koningsdag',
      ],
      [
        'winter via body',
        makeBodyEvent({ watWiltUDoen: 'winter' }),
        'winter',
      ],
    ])('%s', (_, event, expectedWatWiltUDoen) => {
      const result = parseEvent(event);
      expect(result.watWiltUDoen).toBe(expectedWatWiltUDoen);
    });
  });

  describe('gemeentegrond & priveterrein', () => {
    it.each<[
      string,
      ReturnType<typeof makeEvent>,
      { watWiltUDoen: string; startdatum: Date; einddatum: Date },
    ]>([
      [
        'gemeentegrond with short duration via query params',
        makeEvent({
          watWiltUDoen: 'gemeentegrond',
          startdatum: '2025-01-01',
          einddatum: '2025-01-31',
        }),
        {
          watWiltUDoen: 'gemeentegrond',
          startdatum: new Date('2025-01-01'),
          einddatum: new Date('2025-01-31'),
        },
      ],
      [
        'priveterrein with long duration via query params',
        makeEvent({
          watWiltUDoen: 'priveterrein',
          startdatum: '2025-01-01',
          einddatum: '2025-03-01',
        }),
        {
          watWiltUDoen: 'priveterrein',
          startdatum: new Date('2025-01-01'),
          einddatum: new Date('2025-03-01'),
        },
      ],
      [
        'gemeentegrond via body',
        makeBodyEvent({
          watWiltUDoen: 'gemeentegrond',
          startdatum: '2025-01-01',
          einddatum: '2025-01-31',
        }),
        {
          watWiltUDoen: 'gemeentegrond',
          startdatum: new Date('2025-01-01'),
          einddatum: new Date('2025-01-31'),
        },
      ],
    ])('%s', (_, event, expected) => {
      const result = parseEvent(event);
      expect(result.watWiltUDoen).toBe(expected.watWiltUDoen);
      expect(result.startdatum).toEqual(expected.startdatum);
      expect(result.einddatum).toEqual(expected.einddatum);
    });
  });

  describe('concerten - time formats', () => {
    it.each<[
      string,
      ReturnType<typeof makeEvent>,
      { tijdStartConcerten: string; tijdEindeConcerten: string },
    ]>([
      // ── HH:MM format ──────────────────────────────────────────────────────
      [
        'HH:MM — ending before 22:00',
        makeEvent({
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '20:00',
          tijdEindeConcerten: '21:30',
        }),
        { tijdStartConcerten: '20:00', tijdEindeConcerten: '21:30' },
      ],
      [
        'HH:MM — ending after 22:00',
        makeEvent({
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '20:00',
          tijdEindeConcerten: '23:00',
        }),
        { tijdStartConcerten: '20:00', tijdEindeConcerten: '23:00' },
      ],
      [
        'HH:MM — overnight',
        makeEvent({
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '23:00',
          tijdEindeConcerten: '01:00',
        }),
        { tijdStartConcerten: '23:00', tijdEindeConcerten: '01:00' },
      ],
      // ── HH:MM:SS format ───────────────────────────────────────────────────
      [
        'HH:MM:SS — ending before 22:00',
        makeEvent({
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '20:00:00',
          tijdEindeConcerten: '21:30:45',
        }),
        { tijdStartConcerten: '20:00:00', tijdEindeConcerten: '21:30:45' },
      ],
      [
        'HH:MM:SS — ending after 22:00',
        makeEvent({
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '20:00:00',
          tijdEindeConcerten: '23:00:00',
        }),
        { tijdStartConcerten: '20:00:00', tijdEindeConcerten: '23:00:00' },
      ],
      [
        'HH:MM:SS — overnight',
        makeEvent({
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '23:00:00',
          tijdEindeConcerten: '01:00:00',
        }),
        { tijdStartConcerten: '23:00:00', tijdEindeConcerten: '01:00:00' },
      ],
      [
        'HH:MM:SS — seconds at boundary (22:00:01 is late)',
        makeEvent({
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '20:00:00',
          tijdEindeConcerten: '22:00:01',
        }),
        { tijdStartConcerten: '20:00:00', tijdEindeConcerten: '22:00:01' },
      ],
      [
        'HH:MM:SS — exactly 22:00:00 is not late',
        makeEvent({
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '20:00:00',
          tijdEindeConcerten: '22:00:00',
        }),
        { tijdStartConcerten: '20:00:00', tijdEindeConcerten: '22:00:00' },
      ],
      // ── mixed formats ─────────────────────────────────────────────────────
      [
        'mixed: start HH:MM, end HH:MM:SS',
        makeEvent({
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '20:00',
          tijdEindeConcerten: '21:30:00',
        }),
        { tijdStartConcerten: '20:00', tijdEindeConcerten: '21:30:00' },
      ],
      [
        'mixed: start HH:MM:SS, end HH:MM',
        makeEvent({
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '20:00:00',
          tijdEindeConcerten: '21:30',
        }),
        { tijdStartConcerten: '20:00:00', tijdEindeConcerten: '21:30' },
      ],
      // ── via body ──────────────────────────────────────────────────────────
      [
        'HH:MM:SS via body',
        makeBodyEvent({
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '20:00:00',
          tijdEindeConcerten: '21:00:00',
        }),
        { tijdStartConcerten: '20:00:00', tijdEindeConcerten: '21:00:00' },
      ],
    ])('%s', (_, event, expected) => {
      const result = parseEvent(event);
      expect(result.watWiltUDoen).toBe('concerten');
      expect(result.tijdStartConcerten).toBe(expected.tijdStartConcerten);
      expect(result.tijdEindeConcerten).toBe(expected.tijdEindeConcerten);
    });
  });

  describe('body overrides query params', () => {
    it('uses body value when both query params and body contain watWiltUDoen', () => {
      const event = {
        queryStringParameters: { watWiltUDoen: 'koningsdag' },
        body: JSON.stringify({ watWiltUDoen: 'winter' }),
        isBase64Encoded: false,
      };
      expect(parseEvent(event).watWiltUDoen).toBe('winter');
    });

    it('merges query params and body, body takes precedence per field', () => {
      const event = {
        queryStringParameters: {
          watWiltUDoen: 'gemeentegrond',
          startdatum: '2025-01-01',
        },
        body: JSON.stringify({ einddatum: '2025-01-31' }),
        isBase64Encoded: false,
      };
      const result = parseEvent(event);
      expect(result.watWiltUDoen).toBe('gemeentegrond');
      expect(result.startdatum).toEqual(new Date('2025-01-01'));
      expect(result.einddatum).toEqual(new Date('2025-01-31'));
    });
  });

  describe('base64 encoded body', () => {
    it('decodes and parses a base64 encoded body (koningsdag)', () => {
      const encoded = Buffer.from(
        JSON.stringify({ watWiltUDoen: 'koningsdag' }),
      ).toString('base64');
      expect(parseEvent(makeEvent(null, encoded, true)).watWiltUDoen).toBe(
        'koningsdag',
      );
    });

    it('decodes a base64 body with dates', () => {
      const encoded = Buffer.from(
        JSON.stringify({
          watWiltUDoen: 'gemeentegrond',
          startdatum: '2025-01-01',
          einddatum: '2025-03-01',
        }),
      ).toString('base64');
      const result = parseEvent(makeEvent(null, encoded, true));
      expect(result.watWiltUDoen).toBe('gemeentegrond');
      expect(result.startdatum).toEqual(new Date('2025-01-01'));
      expect(result.einddatum).toEqual(new Date('2025-03-01'));
    });

    it('decodes a base64 body with HH:MM:SS times', () => {
      const encoded = Buffer.from(
        JSON.stringify({
          watWiltUDoen: 'concerten',
          tijdStartConcerten: '20:00:00',
          tijdEindeConcerten: '23:00:00',
        }),
      ).toString('base64');
      const result = parseEvent(makeEvent(null, encoded, true));
      expect(result.tijdStartConcerten).toBe('20:00:00');
      expect(result.tijdEindeConcerten).toBe('23:00:00');
    });
  });

  describe('extra/unknown fields are ignored', () => {
    it('ignores unknown query parameters', () => {
      const event = makeEvent({
        watWiltUDoen: 'winter',
        unknownField: 'someValue',
      });
      expect(() => parseEvent(event)).not.toThrow();
    });
  });
});

// ─── Failure Modes: watWiltUDoen ──────────────────────────────────────────────

describe('parseEvent - failure modes: watWiltUDoen', () => {
  it.each<[string, ReturnType<typeof makeEvent>]>([
    ['missing watWiltUDoen in empty query params', makeEvent({})],
    ['null queryStringParameters and no body', makeEvent(null, null)],
    ['invalid watWiltUDoen value', makeEvent({ watWiltUDoen: 'invalid-value' })],
    ['empty string watWiltUDoen', makeEvent({ watWiltUDoen: '' })],
  ])('%s', (_, event) => {
    expectParseError(() => parseEvent(event), 'watWiltUDoen');
  });
});

// ─── Failure Modes: dates ─────────────────────────────────────────────────────

describe('parseEvent - failure modes: dates', () => {
  it.each<[string, ReturnType<typeof makeEvent>, string, string | undefined]>([
    [
      'gemeentegrond missing startdatum',
      makeEvent({ watWiltUDoen: 'gemeentegrond', einddatum: '2025-01-31' }),
      'startdatum',
      undefined,
    ],
    [
      'gemeentegrond missing einddatum',
      makeEvent({ watWiltUDoen: 'gemeentegrond', startdatum: '2025-01-01' }),
      'einddatum',
      undefined,
    ],
    [
      'gemeentegrond missing both dates',
      makeEvent({ watWiltUDoen: 'gemeentegrond' }),
      'startdatum',
      undefined,
    ],
    [
      'priveterrein missing startdatum',
      makeEvent({ watWiltUDoen: 'priveterrein', einddatum: '2025-01-31' }),
      'startdatum',
      undefined,
    ],
    [
      'priveterrein missing einddatum',
      makeEvent({ watWiltUDoen: 'priveterrein', startdatum: '2025-01-01' }),
      'einddatum',
      undefined,
    ],
    [
      'einddatum before startdatum',
      makeEvent({
        watWiltUDoen: 'gemeentegrond',
        startdatum: '2025-01-31',
        einddatum: '2025-01-01',
      }),
      'einddatum',
      'after startdatum',
    ],
    [
      'einddatum equal to startdatum',
      makeEvent({
        watWiltUDoen: 'gemeentegrond',
        startdatum: '2025-01-01',
        einddatum: '2025-01-01',
      }),
      'einddatum',
      'after startdatum',
    ],
    [
      'invalid startdatum format',
      makeEvent({
        watWiltUDoen: 'gemeentegrond',
        startdatum: 'not-a-date',
        einddatum: '2025-01-31',
      }),
      'startdatum',
      undefined,
    ],
    [
      'invalid einddatum format (wrong order)',
      makeEvent({
        watWiltUDoen: 'gemeentegrond',
        startdatum: '2025-01-01',
        einddatum: '31-01-2025',
      }),
      'einddatum',
      undefined,
    ],
    [
      'startdatum with time component (not ISO date)',
      makeEvent({
        watWiltUDoen: 'gemeentegrond',
        startdatum: '2025-01-01T10:00:00',
        einddatum: '2025-01-31',
      }),
      'startdatum',
      undefined,
    ],
  ])(
    '%s',
    (_, event, expectedField, expectedMessage) => {
      expectParseError(() => parseEvent(event), expectedField, expectedMessage);
    },
  );
});

// ─── Failure Modes: concert times ─────────────────────────────────────────────

describe('parseEvent - failure modes: concert times', () => {
  it.each<[string, ReturnType<typeof makeEvent>, string]>([
    // ── missing fields ────────────────────────────────────────────────────
    [
      'missing tijdStartConcerten',
      makeEvent({ watWiltUDoen: 'concerten', tijdEindeConcerten: '21:00' }),
      'tijdStartConcerten',
    ],
    [
      'missing tijdEindeConcerten',
      makeEvent({ watWiltUDoen: 'concerten', tijdStartConcerten: '20:00' }),
      'tijdEindeConcerten',
    ],
    [
      'missing both times',
      makeEvent({ watWiltUDoen: 'concerten' }),
      'tijdStartConcerten',
    ],
    // ── invalid HH:MM ─────────────────────────────────────────────────────
    [
      'tijdStartConcerten missing leading zero (8:00)',
      makeEvent({
        watWiltUDoen: 'concerten',
        tijdStartConcerten: '8:00',
        tijdEindeConcerten: '21:00',
      }),
      'tijdStartConcerten',
    ],
    [
      'tijdEindeConcerten hour out of range (25:00)',
      makeEvent({
        watWiltUDoen: 'concerten',
        tijdStartConcerten: '20:00',
        tijdEindeConcerten: '25:00',
      }),
      'tijdEindeConcerten',
    ],
    [
      'tijdStartConcerten as plain number string (2000)',
      makeEvent({
        watWiltUDoen: 'concerten',
        tijdStartConcerten: '2000',
        tijdEindeConcerten: '21:00',
      }),
      'tijdStartConcerten',
    ],
    // ── invalid HH:MM:SS ──────────────────────────────────────────────────
    [
      'tijdStartConcerten seconds out of range (20:00:60)',
      makeEvent({
        watWiltUDoen: 'concerten',
        tijdStartConcerten: '20:00:60',
        tijdEindeConcerten: '21:00:00',
      }),
      'tijdStartConcerten',
    ],
    [
      'tijdEindeConcerten seconds out of range (21:00:99)',
      makeEvent({
        watWiltUDoen: 'concerten',
        tijdStartConcerten: '20:00:00',
        tijdEindeConcerten: '21:00:99',
      }),
      'tijdEindeConcerten',
    ],
    [
      'tijdEindeConcerten hour out of range with seconds (25:00:00)',
      makeEvent({
        watWiltUDoen: 'concerten',
        tijdStartConcerten: '20:00:00',
        tijdEindeConcerten: '25:00:00',
      }),
      'tijdEindeConcerten',
    ],
    [
      'tijdStartConcerten missing leading zero with seconds (8:00:00)',
      makeEvent({
        watWiltUDoen: 'concerten',
        tijdStartConcerten: '8:00:00',
        tijdEindeConcerten: '21:00:00',
      }),
      'tijdStartConcerten',
    ],
    // ── malformed strings ─────────────────────────────────────────────────
    [
      'tijdStartConcerten with trailing colon (20:00:)',
      makeEvent({
        watWiltUDoen: 'concerten',
        tijdStartConcerten: '20:00:',
        tijdEindeConcerten: '21:00',
      }),
      'tijdStartConcerten',
    ],
    [
      'tijdEindeConcerten with extra segment (21:00:00:00)',
      makeEvent({
        watWiltUDoen: 'concerten',
        tijdStartConcerten: '20:00',
        tijdEindeConcerten: '21:00:00:00',
      }),
      'tijdEindeConcerten',
    ],
    [
      'tijdStartConcerten as empty string',
      makeEvent({
        watWiltUDoen: 'concerten',
        tijdStartConcerten: '',
        tijdEindeConcerten: '21:00',
      }),
      'tijdStartConcerten',
    ],
  ])(
    '%s',
    (_, event, expectedField) => {
      expectParseError(() => parseEvent(event), expectedField);
    },
  );
});

// ─── Failure Modes: malformed event ──────────────────────────────────────────

describe('parseEvent - failure modes: malformed event', () => {
  it.each([
    ['null event', null],
    ['undefined event', undefined],
    ['empty object', {}],
    ['string event', 'a string'],
    ['array event', []],
  ])('%s throws ParseError', (_, event) => {
    expect(() => parseEvent(event)).toThrow(ParseError);
  });

  it('silently ignores non-JSON body and falls back to query params', () => {
    const event = {
      queryStringParameters: { watWiltUDoen: 'winter' },
      body: 'not-json',
      isBase64Encoded: false,
    };
    expect(parseEvent(event).watWiltUDoen).toBe('winter');
  });

  it('throws ParseError when body is the only source and is not valid JSON', () => {
    expect(() => parseEvent(makeEvent(null, 'not-json'))).toThrow(ParseError);
  });
});

// ─── ParseError shape ─────────────────────────────────────────────────────────

describe('ParseError shape', () => {
  it('contains structured issues array', () => {
    const error = catchParseError(() =>
      parseEvent(makeEvent({ watWiltUDoen: 'invalid' })),
    );
    expect(error.issues).toBeInstanceOf(Array);
    expect(error.issues.length).toBeGreaterThan(0);
    expect(error.issues[0]).toHaveProperty('path');
    expect(error.issues[0]).toHaveProperty('message');
  });

  it('message string contains field name', () => {
    const error = catchParseError(() =>
      parseEvent(makeEvent({ watWiltUDoen: 'invalid' })),
    );
    expect(error.message).toContain('watWiltUDoen');
  });

  it('collects multiple issues in one error (gemeentegrond without dates)', () => {
    const error = catchParseError(() =>
      parseEvent(makeEvent({ watWiltUDoen: 'gemeentegrond' })),
    );
    expect(error.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('collects multiple issues in one error (concerten without times)', () => {
    const error = catchParseError(() =>
      parseEvent(makeEvent({ watWiltUDoen: 'concerten' })),
    );
    expect(error.issues.length).toBeGreaterThanOrEqual(2);
  });
});
