import { amsterdamCalendarDayToAbsoluteTimeRange, previousAmsterdamCalendarDay } from '../AmsterdamTimeRange';

describe('previousAmsterdamCalendarDay', () => {
  test('just after midnight in Amsterdam, while it is still the evening before in UTC', () => {
    // 00:30 on 16 July in Amsterdam (CEST)
    expect(previousAmsterdamCalendarDay(new Date('2026-07-15T22:30:00Z'))).toEqual('2026-07-15');
  });

  test('the day after the clock goes forward or back', () => {
    // 00:30 on 30 March in Amsterdam, the day after the 23-hour day
    expect(previousAmsterdamCalendarDay(new Date('2026-03-29T22:30:00Z'))).toEqual('2026-03-29');
    // 00:30 on 26 October in Amsterdam, the day after the 25-hour day
    expect(previousAmsterdamCalendarDay(new Date('2026-10-25T23:30:00Z'))).toEqual('2026-10-25');
  });

  test('a year boundary', () => {
    expect(previousAmsterdamCalendarDay(new Date('2027-01-01T08:00:00Z'))).toEqual('2026-12-31');
  });
});

describe('amsterdamCalendarDayToAbsoluteTimeRange', () => {
  test('a normal winter day (CET, UTC+1)', () => {
    const range = amsterdamCalendarDayToAbsoluteTimeRange({ year: 2026, month: 1, day: 15 });
    expect(range.fromInclusive.toISOString()).toEqual('2026-01-14T23:00:00.000Z');
    expect(range.toExclusive.toISOString()).toEqual('2026-01-15T23:00:00.000Z');
  });

  test('a normal summer day (CEST, UTC+2)', () => {
    const range = amsterdamCalendarDayToAbsoluteTimeRange({ year: 2026, month: 7, day: 15 });
    expect(range.fromInclusive.toISOString()).toEqual('2026-07-14T22:00:00.000Z');
    expect(range.toExclusive.toISOString()).toEqual('2026-07-15T22:00:00.000Z');
  });

  test('the 23-hour day when clocks spring forward (2026-03-29)', () => {
    const range = amsterdamCalendarDayToAbsoluteTimeRange({ year: 2026, month: 3, day: 29 });
    expect(range.fromInclusive.toISOString()).toEqual('2026-03-28T23:00:00.000Z');
    expect(range.toExclusive.toISOString()).toEqual('2026-03-29T22:00:00.000Z');
    expect(range.toExclusive.getTime() - range.fromInclusive.getTime()).toEqual(23 * 60 * 60 * 1000);
  });

  test('the 25-hour day when clocks fall back (2026-10-25)', () => {
    const range = amsterdamCalendarDayToAbsoluteTimeRange({ year: 2026, month: 10, day: 25 });
    expect(range.fromInclusive.toISOString()).toEqual('2026-10-24T22:00:00.000Z');
    expect(range.toExclusive.toISOString()).toEqual('2026-10-25T23:00:00.000Z');
    expect(range.toExclusive.getTime() - range.fromInclusive.getTime()).toEqual(25 * 60 * 60 * 1000);
  });

  test('a month boundary (2026-01-31 into February)', () => {
    const range = amsterdamCalendarDayToAbsoluteTimeRange({ year: 2026, month: 1, day: 31 });
    expect(range.fromInclusive.toISOString()).toEqual('2026-01-30T23:00:00.000Z');
    expect(range.toExclusive.toISOString()).toEqual('2026-01-31T23:00:00.000Z');
  });

  test('a year boundary (2026-12-31 into 2027)', () => {
    const range = amsterdamCalendarDayToAbsoluteTimeRange({ year: 2026, month: 12, day: 31 });
    expect(range.fromInclusive.toISOString()).toEqual('2026-12-30T23:00:00.000Z');
    expect(range.toExclusive.toISOString()).toEqual('2026-12-31T23:00:00.000Z');
  });

  test('the range is half-open: toExclusive of one day equals fromInclusive of the next', () => {
    const day = amsterdamCalendarDayToAbsoluteTimeRange({ year: 2026, month: 6, day: 10 });
    const nextDay = amsterdamCalendarDayToAbsoluteTimeRange({ year: 2026, month: 6, day: 11 });
    expect(day.toExclusive.getTime()).toEqual(nextDay.fromInclusive.getTime());
  });
});
