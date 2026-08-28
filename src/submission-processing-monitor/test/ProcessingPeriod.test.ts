import { resolveProcessingPeriod } from '../model/ProcessingPeriod';

describe('resolveProcessingPeriod', () => {
  test('resolves PREVIOUS_DAY as the previous Dutch calendar day on a normal day', () => {
    const now = new Date('2026-06-15T10:00:00Z');
    expect(resolveProcessingPeriod({ mode: 'PREVIOUS_DAY' }, now)).toEqual({
      from: '2026-06-14',
      to: '2026-06-15',
    });
  });

  test('keeps the previous Dutch calendar day correct across the DST spring-forward transition', () => {
    // 2026-03-29 is a 23-hour day in Europe/Amsterdam (clocks move from 02:00 CET to 03:00 CEST).
    // Just after local midnight on 2026-03-30, "now minus 24 hours" would land on 2026-03-28, not 2026-03-29.
    const now = new Date('2026-03-29T22:05:00Z'); // 2026-03-30T00:05 Europe/Amsterdam (CEST, UTC+2)
    expect(resolveProcessingPeriod({ mode: 'PREVIOUS_DAY' }, now)).toEqual({
      from: '2026-03-29',
      to: '2026-03-30',
    });
  });

  test('passes an explicit PERIOD through unchanged', () => {
    const period = resolveProcessingPeriod({ mode: 'PERIOD', from: '2026-08-01', to: '2026-08-08' });
    expect(period).toEqual({ from: '2026-08-01', to: '2026-08-08' });
  });
});
