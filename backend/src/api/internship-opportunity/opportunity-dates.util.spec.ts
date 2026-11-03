import {
  addMonthsIST,
  endOfDayIST,
  parseApiDate,
  parseCalendarDate,
  startOfDayIST,
  todayStartIST,
} from './opportunity-dates.util';

describe('opportunity-dates.util', () => {
  describe('parseCalendarDate', () => {
    it('accepts yyyy-mm-dd, dd/mm/yyyy and dd-mm-yyyy', () => {
      expect(parseCalendarDate('2027-01-15')).toEqual({ y: 2027, m: 1, d: 15 });
      expect(parseCalendarDate('15/01/2027')).toEqual({ y: 2027, m: 1, d: 15 });
      expect(parseCalendarDate('15-1-2027')).toEqual({ y: 2027, m: 1, d: 15 });
    });

    it('reads an Excel date cell (UTC midnight) as that calendar day', () => {
      expect(parseCalendarDate(new Date(Date.UTC(2027, 0, 15)))).toEqual({ y: 2027, m: 1, d: 15 });
    });

    it('rejects impossible and malformed dates', () => {
      expect(parseCalendarDate('2027-02-30')).toBeNull();
      expect(parseCalendarDate('31/04/2027')).toBeNull();
      expect(parseCalendarDate('15 Jan')).toBeNull();
      expect(parseCalendarDate('')).toBeNull();
      expect(parseCalendarDate(null)).toBeNull();
      expect(parseCalendarDate(new Date('invalid'))).toBeNull();
      expect(parseCalendarDate('1999-01-01')).toBeNull();
    });
  });

  describe('IST boundaries', () => {
    it('start of day is 00:00 IST and deadline is 23:59:59.999 IST on the same day', () => {
      const c = { y: 2027, m: 1, d: 15 };
      expect(startOfDayIST(c).toISOString()).toBe('2027-01-14T18:30:00.000Z');
      expect(endOfDayIST(c).toISOString()).toBe('2027-01-15T18:29:59.999Z');
    });

    it('todayStartIST is the IST day containing the instant', () => {
      // 2027-01-15 20:00 UTC == 2027-01-16 01:30 IST -> IST day is the 16th
      const t = todayStartIST(new Date('2027-01-15T20:00:00Z'));
      expect(t.toISOString()).toBe('2027-01-15T18:30:00.000Z');
    });

    it('addMonthsIST clamps to month end', () => {
      const start = startOfDayIST({ y: 2027, m: 1, d: 31 });
      expect(addMonthsIST(start, 1).toISOString()).toBe(startOfDayIST({ y: 2027, m: 2, d: 28 }).toISOString());
      expect(addMonthsIST(start, 6).toISOString()).toBe(startOfDayIST({ y: 2027, m: 7, d: 31 }).toISOString());
    });
  });

  it('parseApiDate accepts a full ISO string by its date part', () => {
    expect(parseApiDate('2027-03-05T10:00:00.000Z')).toEqual({ y: 2027, m: 3, d: 5 });
    expect(parseApiDate('')).toBeNull();
  });
});
