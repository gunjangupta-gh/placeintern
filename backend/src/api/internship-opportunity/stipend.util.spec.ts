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
