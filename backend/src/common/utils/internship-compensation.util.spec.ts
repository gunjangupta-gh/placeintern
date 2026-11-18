import { BadRequestException } from '@nestjs/common';
import { missingCompensationFields, normalizeCompensation } from './internship-compensation.util';

describe('normalizeCompensation', () => {
  it('requires a valid type', () => {
    expect(() => normalizeCompensation({})).toThrow(BadRequestException);
    expect(() => normalizeCompensation({ internshipType: 'PAID' })).toThrow(BadRequestException);
  });

  it('WITH_STIPEND needs a positive stipend and drops the fee', () => {
    expect(normalizeCompensation({ internshipType: 'WITH_STIPEND', stipend: '8,000', studentFeeAmount: 500 })).toEqual({
      internshipType: 'WITH_STIPEND',
      stipend: '8000',
      studentFeeAmount: null,
    });
    expect(() => normalizeCompensation({ internshipType: 'WITH_STIPEND' })).toThrow(BadRequestException);
    expect(() => normalizeCompensation({ internshipType: 'WITH_STIPEND', stipend: 0 })).toThrow(BadRequestException);
    expect(() => normalizeCompensation({ internshipType: 'WITH_STIPEND', stipend: 'abc' })).toThrow(BadRequestException);
  });

  it('PAID_BY_STUDENT needs a positive fee and drops the stipend', () => {
    expect(normalizeCompensation({ internshipType: 'PAID_BY_STUDENT', stipend: 9000, studentFeeAmount: '2500' })).toEqual({
      internshipType: 'PAID_BY_STUDENT',
      stipend: null,
      studentFeeAmount: 2500,
    });
    expect(() => normalizeCompensation({ internshipType: 'PAID_BY_STUDENT', studentFeeAmount: -1 })).toThrow(BadRequestException);
  });

  it('WITHOUT_STIPEND clears both amounts', () => {
    expect(normalizeCompensation({ internshipType: 'WITHOUT_STIPEND', stipend: 5000, studentFeeAmount: 100 })).toEqual({
      internshipType: 'WITHOUT_STIPEND',
      stipend: null,
      studentFeeAmount: null,
    });
  });
});

describe('missingCompensationFields', () => {
  it('flags a missing type', () => {
    expect(missingCompensationFields({ internshipType: null }).map((f) => f.key)).toEqual(['internshipType']);
  });
  it('flags a missing amount for the chosen type only', () => {
    expect(missingCompensationFields({ internshipType: 'WITH_STIPEND', stipend: null } as any).map((f) => f.key)).toEqual(['stipend']);
    expect(missingCompensationFields({ internshipType: 'PAID_BY_STUDENT', studentFeeAmount: null } as any).map((f) => f.key)).toEqual(['studentFeeAmount']);
    expect(missingCompensationFields({ internshipType: 'WITHOUT_STIPEND' } as any)).toEqual([]);
    expect(missingCompensationFields({ internshipType: 'WITH_STIPEND', stipend: '8000' } as any)).toEqual([]);
  });
});
