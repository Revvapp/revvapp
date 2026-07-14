import {
  dateKeyInRange,
  endOfMonth,
  endOfWeekSaturday,
  formatJobDate,
  getLocalDateKey,
  getTodayKey,
  startOfMonth,
  startOfWeekSunday,
} from '@/lib/dateKeys';

describe('getLocalDateKey', () => {
  it('formats as YYYY-MM-DD with zero padding (local time)', () => {
    // Month is 0-indexed: 6 = July.
    expect(getLocalDateKey(new Date(2026, 6, 5))).toBe('2026-07-05');
    expect(getLocalDateKey(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(getLocalDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('dateKeyInRange', () => {
  const start = new Date(2026, 6, 1);
  const end = new Date(2026, 6, 31);

  it('includes the boundaries', () => {
    expect(dateKeyInRange('2026-07-01', start, end)).toBe(true);
    expect(dateKeyInRange('2026-07-31', start, end)).toBe(true);
  });

  it('excludes dates outside the range', () => {
    expect(dateKeyInRange('2026-06-30', start, end)).toBe(false);
    expect(dateKeyInRange('2026-08-01', start, end)).toBe(false);
  });
});

describe('week / month boundaries', () => {
  const d = new Date(2026, 6, 8); // arbitrary mid-week/mid-month date

  it('startOfWeekSunday lands on a Sunday', () => {
    expect(startOfWeekSunday(d).getDay()).toBe(0);
  });

  it('endOfWeekSaturday lands on a Saturday, 6 days after the start', () => {
    const s = startOfWeekSunday(d);
    const e = endOfWeekSaturday(d);
    expect(e.getDay()).toBe(6);
    expect(Math.round((e.getTime() - s.getTime()) / 86400000)).toBe(6);
  });

  it('startOfMonth is the 1st', () => {
    expect(startOfMonth(d).getDate()).toBe(1);
  });

  it('endOfMonth is the last calendar day', () => {
    expect(endOfMonth(new Date(2026, 6, 8)).getDate()).toBe(31); // July -> 31
    expect(endOfMonth(new Date(2026, 1, 8)).getDate()).toBe(28); // Feb 2026 -> 28
  });
});

describe('formatJobDate', () => {
  it('labels today and tomorrow', () => {
    const todayKey = getTodayKey();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = getLocalDateKey(tomorrow);

    expect(formatJobDate(todayKey)).toBe('Today');
    expect(formatJobDate(tomorrowKey)).toBe('Tomorrow');
  });

  it('formats other dates without the Today/Tomorrow labels', () => {
    const label = formatJobDate('2020-03-15');
    expect(typeof label).toBe('string');
    expect(label).not.toBe('Today');
    expect(label).not.toBe('Tomorrow');
    expect(label).toContain('15');
  });
});
