import { parseMonthlyStipend } from './stipend.util';

describe('parseMonthlyStipend', () => {
  it.each([
    ['8000 per month', 8000],
    ['INR 9500 per month', 9500],
    ['Rs. 12,000/-', 12000],
    ['10K', 10000],
    ['10000 per month + marketing expenses', 10000],
    ['6000', 6000],
    ['1.2 lakh per annum', 10000],
    ['120000 per year', 10000],
    ['3.6 LPA', 30000],
  ])('%p -> %p', (text, expected) => {
    expect(parseMonthlyStipend(text)).toBe(expected);
  });

  it.each([[null], [undefined], [''], ['No'], ['No stipend'], ['Unpaid'], ['As per norms'], ['0'], ['500 per day'], ['Rs 50 per hour']])(
    '%p has no usable amount',
    (text) => {
      expect(parseMonthlyStipend(text as any)).toBeNull();
    },
  );
});

import { normalizeStipend, parseStipendAmount } from './stipend.util';

describe('normalizeStipend (saved format)', () => {
  it.each([
    ['10000', '10,000'],
    ['10,000', '10,000'],
    [' 8000 ', '8,000'],
    ['₹12000', '12,000'],
    ['Rs. 9,500/-', '9,500'],
    ['INR 100000', '1,00,000'],
    [500, '500'],
    [15000, '15,000'],
  ])('%p -> %p', (input, expected) => {
    expect(normalizeStipend(input)).toBe(expected);
  });

  it.each([[null], [undefined], [''], ['   ']])('%p is blank (null)', (input) => {
    expect(normalizeStipend(input as any)).toBeNull();
  });

  it.each([['8000 per month'], ['10K'], ['abc'], ['0'], ['-500'], ['1.5'], ['12,34'], ['99999999']])('%p is invalid', (input) => {
    expect(normalizeStipend(input)).toBeUndefined();
    expect(parseStipendAmount(input)).toBeNull();
  });
});
