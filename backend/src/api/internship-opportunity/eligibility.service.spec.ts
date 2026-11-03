import { OpportunityStatus } from '../../generated/prisma/client';
import {
  computeMissingProfileFields,
  applicationCap,
  evaluateEligibility,
  EvaluationInput,
  StudentContext,
  summariseApplications,
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
    applicationDeadline: future,
    eligibleYears: [],
    branches: [
      { branchId: 'b-me', positions: 10, approvedCount: 0, maxApplications: null },
      { branchId: 'b-ee', positions: 5, approvedCount: 0, maxApplications: null },
    ],
  },
  branchApplications: 0,
  appliedToThis: false,
  hasConfirmedInternship: false,
  pendingApplications: 0,
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

  describe('branch-wise positions and application limits', () => {
    const withMe = (over: Partial<{ positions: number; approvedCount: number; maxApplications: number | null }>) => {
      const base = input().opportunity;
      return {
        ...base,
        branches: base.branches.map((b) => (b.branchId === 'b-me' ? { ...b, ...over } : b)),
      };
    };

    it('without a limit, applications are capped at the positions: 10 positions, 10 used -> the 11th is blocked', () => {
      expect(codes(input({ branchApplications: 9 }))).toEqual([]); // 10th can apply
      expect(codes(input({ branchApplications: 10 }))).toContain('APPLICATIONS_FULL'); // 11th cannot
    });

    it('a higher application limit builds a waiting list: 10 positions, limit 15', () => {
      const opportunity = withMe({ positions: 10, maxApplications: 15 });
      expect(codes(input({ opportunity, branchApplications: 10 }))).toEqual([]);
      expect(codes(input({ opportunity, branchApplications: 14 }))).toEqual([]);
      expect(codes(input({ opportunity, branchApplications: 15 }))).toContain('APPLICATIONS_FULL');
    });

    it('closes the branch once every position is filled, even if the limit is not reached', () => {
      const opportunity = withMe({ positions: 10, approvedCount: 10, maxApplications: 30 });
      const c = codes(input({ opportunity, branchApplications: 12 }));
      expect(c).toContain('POSITIONS_FILLED');
      expect(c).not.toContain('APPLICATIONS_FULL');
    });

    it('only the student own branch counts: another branch being full does not block them', () => {
      const base = input().opportunity;
      const opportunity = {
        ...base,
        branches: base.branches.map((b) => (b.branchId === 'b-ee' ? { ...b, approvedCount: 5 } : b)),
      };
      expect(codes(input({ opportunity }))).toEqual([]);
    });

    it('a student of a branch that has no seats on this internship is not eligible', () => {
      const base = input().opportunity;
      const opportunity = { ...base, branches: base.branches.filter((b) => b.branchId !== 'b-me') };
      expect(codes(input({ opportunity }))).toContain('BRANCH_NOT_ELIGIBLE');
    });

    it('applicationCap never goes below the positions', () => {
      expect(applicationCap({ positions: 10, maxApplications: null })).toBe(10);
      expect(applicationCap({ positions: 10, maxApplications: 25 })).toBe(25);
      expect(applicationCap({ positions: 10, maxApplications: 4 })).toBe(10);
    });
  });

  it('allows up to 2 pending applications: 0 and 1 pending can apply, 2 pending cannot', () => {
    expect(codes(input({ pendingApplications: 0 }))).toEqual([]);
    expect(codes(input({ pendingApplications: 1 }))).toEqual([]); // the 2nd application
    expect(codes(input({ pendingApplications: 2 }))).toContain('MAX_APPLICATIONS_REACHED'); // a 3rd
  });

  it('blocks everything once the student already has an internship', () => {
    const c = codes(input({ hasConfirmedInternship: true, pendingApplications: 0 }));
    expect(c).toContain('HAS_INTERNSHIP');
    expect(c).not.toContain('MAX_APPLICATIONS_REACHED');
  });

  it('summariseApplications counts pending and detects a confirmed internship', () => {
    expect(summariseApplications([{ status: 'APPLIED' }, { status: 'SHORTLISTED' }] as any)).toEqual({
      hasConfirmedInternship: false,
      pendingApplications: 2,
    });
    expect(summariseApplications([{ status: 'APPROVED' }] as any)).toEqual({
      hasConfirmedInternship: true,
      pendingApplications: 0,
    });
    expect(summariseApplications([])).toEqual({ hasConfirmedInternship: false, pendingApplications: 0 });
  });

  it('reports ALREADY_APPLIED (not FULL / limit / has-internship) for the student own opportunity', () => {
    const c = codes(input({ appliedToThis: true, pendingApplications: 2, hasConfirmedInternship: true, branchApplications: 10 }));
    expect(c).toContain('ALREADY_APPLIED');
    expect(c).not.toContain('APPLICATIONS_FULL');
    expect(c).not.toContain('MAX_APPLICATIONS_REACHED');
    expect(c).not.toContain('HAS_INTERNSHIP');
  });

  it('blocks inactive accounts', () => {
    const s = completeStudent({ user: { ...completeStudent().user, active: false } as any });
    expect(codes(input({ student: s }))).toContain('ACCOUNT_INACTIVE');
  });
});
