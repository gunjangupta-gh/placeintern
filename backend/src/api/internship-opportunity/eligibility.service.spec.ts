import { OpportunityStatus } from '../../generated/prisma/client';
import {
  computeMissingProfileFields,
  evaluateEligibility,
  EvaluationInput,
  StudentContext,
} from './eligibility.service';

const completeStudent = (over: Partial<StudentContext> = {}): StudentContext =>
  ({
    id: 's1',
    userId: 'u1',
    branchId: 'b-me',
    institutionId: 'i1',
    currentYear: 2,
    gender: 'MALE',
    category: 'GENERAL',
    admissionType: 'REGULAR',
    parentName: 'Parent',
    parentContact: '9999999999',
    address: 'Street 1',
    pinCode: '140001',
    tehsil: 'T',
    district: 'D',
    city: 'C',
    state: 'Punjab',
    user: { name: 'A', email: 'a@x.in', phoneNo: '9876543210', dob: new Date('2005-01-01'), active: true, branchId: 'b-me' },
    ...over,
  }) as StudentContext;

const future = new Date(Date.now() + 7 * 864e5);
const input = (over: Partial<EvaluationInput> = {}): EvaluationInput => ({
  student: completeStudent(),
  opportunity: {
    status: OpportunityStatus.OPEN,
    isDeleted: false,
    positions: 10,
    applicationDeadline: future,
    eligibleYears: [],
    branchIds: ['b-me', 'b-ee'],
  },
  seatsUsed: 0,
  appliedToThis: false,
  hasOtherActiveApplication: false,
  ...over,
});
const codes = (i: EvaluationInput) => evaluateEligibility(i).map((r) => r.code);

describe('computeMissingProfileFields', () => {
  it('returns nothing for a complete profile', () => {
    expect(computeMissingProfileFields(completeStudent())).toEqual([]);
  });

  it('flags blank, whitespace and null fields across student and user', () => {
    const s = completeStudent({ parentName: '   ', tehsil: null, user: { ...completeStudent().user, phoneNo: '', dob: null } as any });
    const keys = computeMissingProfileFields(s).map((m) => m.key);
    expect(keys).toEqual(expect.arrayContaining(['parentName', 'tehsil', 'contact', 'dob']));
    expect(keys).not.toContain('name');
  });
});

describe('evaluateEligibility', () => {
  it('is eligible when everything lines up', () => {
    expect(codes(input())).toEqual([]);
  });

  it('blocks an incomplete profile and names the missing fields', () => {
    const r = evaluateEligibility(input({ student: completeStudent({ district: null }) }));
    expect(r.map((x) => x.code)).toContain('PROFILE_INCOMPLETE');
    expect(r.find((x) => x.code === 'PROFILE_INCOMPLETE')!.message).toContain('District');
  });

  it('blocks a branch that is not in the opportunity (exact id match)', () => {
    expect(codes(input({ student: completeStudent({ branchId: 'b-civil', user: { ...completeStudent().user, branchId: 'b-civil' } as any }) }))).toContain('BRANCH_NOT_ELIGIBLE');
  });

  it('blocks a student with no branch', () => {
    const s = completeStudent({ branchId: null, user: { ...completeStudent().user, branchId: null } as any });
    expect(codes(input({ student: s }))).toContain('NO_BRANCH');
  });

  it('enforces eligible years only when specified', () => {
    const base = input().opportunity;
    expect(codes(input({ opportunity: { ...base, eligibleYears: [3] } }))).toContain('YEAR_NOT_ELIGIBLE');
    expect(codes(input({ opportunity: { ...base, eligibleYears: [2, 3] } }))).not.toContain('YEAR_NOT_ELIGIBLE');
    expect(codes(input({ student: completeStudent({ currentYear: null }), opportunity: { ...base, eligibleYears: [2] } }))).toContain('YEAR_NOT_ELIGIBLE');
  });

  it('blocks closed, filled, deleted and past-deadline opportunities', () => {
    const base = input().opportunity;
    expect(codes(input({ opportunity: { ...base, status: OpportunityStatus.CLOSED } }))).toContain('NOT_OPEN');
    expect(codes(input({ opportunity: { ...base, status: OpportunityStatus.FILLED } }))).toContain('NOT_OPEN');
    expect(codes(input({ opportunity: { ...base, isDeleted: true } }))).toContain('NOT_OPEN');
    expect(codes(input({ opportunity: { ...base, applicationDeadline: new Date(Date.now() - 1000) } }))).toContain('DEADLINE_PASSED');
  });

  it('caps applications at positions: 10 seats, 10 used -> the 11th is blocked', () => {
    expect(codes(input({ seatsUsed: 9 }))).toEqual([]); // 10th can apply
    expect(codes(input({ seatsUsed: 10 }))).toContain('APPLICATIONS_FULL'); // 11th cannot
  });

  it('allows one application only', () => {
    expect(codes(input({ hasOtherActiveApplication: true }))).toContain('HAS_ACTIVE_APPLICATION');
  });

  it('reports ALREADY_APPLIED (not FULL / other-active) for the student own opportunity', () => {
    const c = codes(input({ appliedToThis: true, hasOtherActiveApplication: true, seatsUsed: 10 }));
    expect(c).toContain('ALREADY_APPLIED');
    expect(c).not.toContain('APPLICATIONS_FULL');
    expect(c).not.toContain('HAS_ACTIVE_APPLICATION');
  });

  it('blocks inactive accounts', () => {
    const s = completeStudent({ user: { ...completeStudent().user, active: false } as any });
    expect(codes(input({ student: s }))).toContain('ACCOUNT_INACTIVE');
  });
});
