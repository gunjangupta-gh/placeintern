import { BadRequestException } from '@nestjs/common';
import { ApplicationStatus, InternshipPhase, OpportunityStatus } from '../../generated/prisma/client';
import { OpportunityService } from './opportunity.service';
import { StudentOpportunityService } from './student-opportunity.service';

const future = new Date(Date.now() + 10 * 864e5);
const start = new Date(Date.now() + 40 * 864e5);

const completeStudent = {
  id: 's1', userId: 'u1', branchId: 'b-me', institutionId: 'i1', currentYear: 2,
  gender: 'MALE', category: 'GENERAL', admissionType: 'REGULAR', parentName: 'P', parentContact: '99',
  address: 'a', pinCode: '1', tehsil: 't', district: 'd', city: 'c', state: 's', document: [{ id: 'doc-resume' }],
  user: { name: 'A', email: 'a@x.in', phoneNo: '98', dob: new Date('2005-01-01'), active: true, branchId: 'b-me' },
};

const opp = (over: any = {}) => ({
  id: 'o1', title: 'Production Trainee', status: OpportunityStatus.OPEN, isDeleted: false,
  eligibleYears: [], applicationDeadline: future, durationMonths: 6, stipend: '8000', startDate: start,
  company: { name: 'Godrej', address: 'Mohali' },
  branches: [{ branchId: 'b-me', positions: 10, approvedCount: 0, maxApplications: null }], ...over,
});

describe('StudentOpportunityService.apply', () => {
  function setup(o: { /** applications already made by the student's own branch */ seatsUsed?: number; holding?: Array<{ status: ApplicationStatus }>; mine?: any; opportunity?: any; student?: any } = {}) {
    const lockOrder: string[] = [];
    const tx: any = {
      $queryRaw: jest.fn().mockImplementation(async (strings: TemplateStringsArray) => {
        lockOrder.push(strings.join('?').includes('"Student"') ? 'student' : 'opportunity');
        return [];
      }),
      student: { findUnique: jest.fn().mockResolvedValue(o.student ?? completeStudent) },
      internshipOpportunity: { findFirst: jest.fn().mockResolvedValue(o.opportunity ?? opp()) },
      internshipApplication: {
        count: jest.fn().mockResolvedValue(o.seatsUsed ?? 0),
        findFirst: jest.fn().mockResolvedValue(o.mine ?? null),
        findMany: jest.fn().mockResolvedValue(o.holding ?? []),
        create: jest.fn().mockResolvedValue({ id: 'app1', status: ApplicationStatus.UNDER_REVIEW, opportunityId: 'o1' }),
      },
    };
    const prisma: any = { $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)) };
    const cache: any = { invalidateByTags: jest.fn().mockResolvedValue(undefined) };
    const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
    const elig: any = { getStudentContext: jest.fn().mockResolvedValue(completeStudent) };
    return { svc: new StudentOpportunityService(prisma, cache, audit, elig), tx, cache, lockOrder };
  }

  it('creates an UNDER_REVIEW application, snapshots company data, and holds no contact fields', async () => {
    const { svc, tx, cache } = setup();
    const res = await svc.apply('u1', 'o1');
    expect(res).toEqual({ applicationId: 'app1', status: 'UNDER_REVIEW' });

    const data = tx.internshipApplication.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      studentId: 's1', opportunityId: 'o1', isSelfIdentified: false, status: 'UNDER_REVIEW',
      internshipPhase: InternshipPhase.NOT_STARTED, companyName: 'Godrej', jobProfile: 'Production Trainee',
      internshipDuration: '6 months',
    });
    expect(data.hrName).toBeUndefined();
    expect(data.companyContact).toBeUndefined();
    expect(cache.invalidateByTags).toHaveBeenCalledWith(['applications', 'student:s1']);
  });

  it('locks Student before Opportunity (fixed order avoids deadlocks)', async () => {
    const { svc, lockOrder } = setup();
    await svc.apply('u1', 'o1');
    expect(lockOrder).toEqual(['student', 'opportunity']);
  });

  it('stamps appliedDate explicitly (true first-come-first-served order, set after the locks)', async () => {
    const { svc, tx } = setup();
    await svc.apply('u1', 'o1');
    expect(tx.internshipApplication.create.mock.calls[0][0].data.appliedDate).toBeInstanceOf(Date);
  });

  it('counts applications of the student own branch only', async () => {
    const { svc, tx } = setup();
    await svc.apply('u1', 'o1');
    const where = tx.internshipApplication.count.mock.calls[0][0].where;
    expect(where.opportunityId).toBe('o1');
    expect(JSON.stringify(where.student)).toContain('b-me');
  });

  it('a branch with a higher application limit keeps accepting applicants beyond its positions', async () => {
    const o = opp({ branches: [{ branchId: 'b-me', positions: 10, approvedCount: 0, maxApplications: 15 }] });
    await expect(setup({ seatsUsed: 14, opportunity: o }).svc.apply('u1', 'o1')).resolves.toBeDefined();
    await expect(setup({ seatsUsed: 15, opportunity: o }).svc.apply('u1', 'o1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'APPLICATIONS_FULL' }),
    });
  });

  it('rejects once every position of the branch is filled, whatever the application limit', async () => {
    const o = opp({ branches: [{ branchId: 'b-me', positions: 2, approvedCount: 2, maxApplications: 50 }] });
    await expect(setup({ seatsUsed: 3, opportunity: o }).svc.apply('u1', 'o1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'POSITIONS_FILLED' }),
    });
  });

  it('a different branch being full does not block this branch', async () => {
    const o = opp({
      branches: [
        { branchId: 'b-me', positions: 3, approvedCount: 0, maxApplications: null },
        { branchId: 'b-ee', positions: 1, approvedCount: 1, maxApplications: null },
      ],
    });
    await expect(setup({ seatsUsed: 0, opportunity: o }).svc.apply('u1', 'o1')).resolves.toBeDefined();
  });

  it('10 positions: 9 used -> allowed, 10 used -> blocked and nothing is created', async () => {
    const ok = setup({ seatsUsed: 9 });
    await expect(ok.svc.apply('u1', 'o1')).resolves.toBeDefined();

    const full = setup({ seatsUsed: 10 });
    await expect(full.svc.apply('u1', 'o1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'APPLICATIONS_FULL' }),
    });
    expect(full.tx.internshipApplication.create).not.toHaveBeenCalled();
  });

  it('allows two applications per student: the 2nd succeeds, the 3rd is blocked', async () => {
    const second = setup({ holding: [{ status: ApplicationStatus.APPLIED }] });
    await expect(second.svc.apply('u1', 'o1')).resolves.toBeDefined();

    const third = setup({ holding: [{ status: ApplicationStatus.APPLIED }, { status: ApplicationStatus.SHORTLISTED }] });
    await expect(third.svc.apply('u1', 'o1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MAX_APPLICATIONS_REACHED' }),
    });
    expect(third.tx.internshipApplication.create).not.toHaveBeenCalled();
  });

  it('blocks a student who already has an approved internship, even with no pending ones', async () => {
    const { svc, tx } = setup({ holding: [{ status: ApplicationStatus.APPROVED }] });
    await expect(svc.apply('u1', 'o1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'HAS_INTERNSHIP' }),
    });
    expect(tx.internshipApplication.create).not.toHaveBeenCalled();
  });

  it('blocks re-applying to an opportunity where the student was already rejected', async () => {
    const { svc } = setup({ mine: { id: 'old' } });
    await expect(svc.apply('u1', 'o1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ALREADY_APPLIED' }),
    });
  });

  it('blocks an incomplete profile and a branch mismatch, server-side', async () => {
    const incomplete = setup({ student: { ...completeStudent, district: null } });
    await expect(incomplete.svc.apply('u1', 'o1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROFILE_INCOMPLETE' }),
    });

    const wrongBranch = setup({ opportunity: opp({ branches: [{ branchId: 'b-civil', positions: 5, approvedCount: 0, maxApplications: null }] }) });
    await expect(wrongBranch.svc.apply('u1', 'o1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BRANCH_NOT_ELIGIBLE' }),
    });
  });

  it('blocks after the deadline and on closed opportunities', async () => {
    const late = setup({ opportunity: opp({ applicationDeadline: new Date(Date.now() - 1000) }) });
    await expect(late.svc.apply('u1', 'o1')).rejects.toBeInstanceOf(BadRequestException);
    const closed = setup({ opportunity: opp({ status: OpportunityStatus.CLOSED }) });
    await expect(closed.svc.apply('u1', 'o1')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OpportunityService.approve', () => {
  /** approvedCount / positions are those of the STUDENT'S branch; otherBranches are the other seats on the opportunity. */
  function setup(o: {
    approvedCount?: number; positions?: number; appStatus?: ApplicationStatus; alreadyPlaced?: boolean; withdrawn?: number;
    otherBranches?: Array<{ positions: number; approvedCount: number }>; skippedEarlier?: number; studentBranch?: string | null;
  } = {}) {
    const lockOrder: string[] = [];
    const tx: any = {
      $queryRaw: jest.fn().mockImplementation(async (strings: TemplateStringsArray) => {
        lockOrder.push(strings.join('?').includes('"Student"') ? 'student' : 'opportunity');
        return [];
      }),
      internshipApplication: {
        findUnique: jest.fn().mockImplementation(async ({ select }: any) =>
          select.opportunityId
            ? { opportunityId: 'o1', studentId: 's1' }
            : { id: 'a1', studentId: 's1', status: o.appStatus ?? ApplicationStatus.APPLIED, startDate: start, endDate: null, appliedDate: new Date() }),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(o.alreadyPlaced ? { id: 'other' } : null),
        updateMany: jest.fn().mockResolvedValue({ count: o.withdrawn ?? 0 }),
        count: jest.fn().mockResolvedValue(o.skippedEarlier ?? 0),
      },
      student: {
        findUnique: jest.fn().mockResolvedValue({
          branchId: o.studentBranch === undefined ? 'b-me' : o.studentBranch,
          user: { branchId: null },
        }),
      },
      opportunityBranch: {
        findUnique: jest.fn().mockResolvedValue({
          positions: o.positions ?? 10, approvedCount: o.approvedCount ?? 0, branch: { name: 'Mechanical' },
        }),
        update: jest.fn().mockResolvedValue({}),
        // state AFTER the increment
        findMany: jest.fn().mockResolvedValue([
          { positions: o.positions ?? 10, approvedCount: (o.approvedCount ?? 0) + 1 },
          ...(o.otherBranches ?? []),
        ]),
      },
      internshipOpportunity: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'o1', title: 'PT', positions: o.positions ?? 10, approvedCount: o.approvedCount ?? 0,
          status: OpportunityStatus.OPEN, startDate: start, durationMonths: 6,
          contactName: 'HR', contactPhone: '123', contactEmail: 'hr@x.in',
          company: { name: 'Godrej', email: null, contact: null, address: null },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma: any = { $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)) };
    const cache: any = { invalidateByTags: jest.fn().mockResolvedValue(undefined) };
    const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
    const expected: any = { recalculateExpectedCounts: jest.fn().mockResolvedValue({}) };
    return { svc: new OpportunityService(prisma, cache, audit, expected), tx, prisma, expected, lockOrder };
  }
  const actor = { userId: 'dir', role: 'STATE_DIRECTORATE' };

  it('approves into the existing APPROVED/NOT_STARTED state and initialises report/visit counters', async () => {
    const { svc, tx, expected } = setup({ approvedCount: 3 });
    await svc.approve('a1', { remarks: 'ok' }, actor);
    const data = tx.internshipApplication.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      status: 'APPROVED', internshipPhase: 'NOT_STARTED', isSelected: true,
      hrName: 'HR', hrContact: '123', hrEmail: 'hr@x.in',
    });
    expect(data.endDate.getTime()).toBeGreaterThan(data.startDate.getTime());
    expect(tx.internshipOpportunity.update.mock.calls[0][0].data).toEqual({ approvedCount: { increment: 1 } });
    expect(tx.opportunityBranch.update.mock.calls[0][0]).toMatchObject({
      where: { opportunityId_branchId: { opportunityId: 'o1', branchId: 'b-me' } },
      data: { approvedCount: { increment: 1 } },
    });
    expect(expected.recalculateExpectedCounts).toHaveBeenCalledWith('a1');
  });

  it('marks the opportunity FILLED only when the last position of EVERY branch is approved', async () => {
    const { svc, tx } = setup({ approvedCount: 9, positions: 10 });
    await svc.approve('a1', {}, actor);
    expect(tx.internshipOpportunity.update.mock.calls[0][0].data).toEqual({
      approvedCount: { increment: 1 }, status: OpportunityStatus.FILLED,
    });
  });

  it('stays OPEN when this branch is now full but another branch still has seats', async () => {
    const { svc, tx } = setup({ approvedCount: 9, positions: 10, otherBranches: [{ positions: 4, approvedCount: 1 }] });
    await svc.approve('a1', {}, actor);
    expect(tx.internshipOpportunity.update.mock.calls[0][0].data).toEqual({ approvedCount: { increment: 1 } });
  });

  it("refuses to over-approve beyond the student's branch positions, even if other branches have seats", async () => {
    const { svc, tx } = setup({ approvedCount: 10, positions: 10, otherBranches: [{ positions: 4, approvedCount: 0 }] });
    await expect(svc.approve('a1', {}, actor)).rejects.toThrow(/All 10 position\(s\) for Mechanical are already filled/);
    expect(tx.internshipApplication.update).not.toHaveBeenCalled();
  });

  it('refuses a student whose branch has no seats on this opportunity', async () => {
    const { svc, tx } = setup({ studentBranch: null });
    await expect(svc.approve('a1', {}, actor)).rejects.toThrow(/branch is not eligible/);
    expect(tx.internshipApplication.update).not.toHaveBeenCalled();
  });

  it('reports how many earlier applicants of the same branch were skipped (first come, first served)', async () => {
    const { svc, tx } = setup({ skippedEarlier: 2 });
    const res = await svc.approve('a1', {}, actor);
    expect(res.skippedEarlierApplicants).toBe(2);
    const where = tx.internshipApplication.count.mock.calls[0][0].where;
    expect(where.OR).toEqual(expect.arrayContaining([expect.objectContaining({ appliedDate: { lt: expect.any(Date) } })]));
  });

  it('bulk approve processes the earliest applicant first', async () => {
    const { svc, prisma } = setup();
    prisma.internshipApplication = {
      findMany: jest.fn().mockResolvedValue([
        { id: 'late', appliedDate: new Date('2026-11-03T10:00:05Z') },
        { id: 'early', appliedDate: new Date('2026-11-03T10:00:01Z') },
        { id: 'mid', appliedDate: new Date('2026-11-03T10:00:03Z') },
      ]),
    };
    const order: string[] = [];
    jest.spyOn(svc, 'approve').mockImplementation(async (id: string) => {
      order.push(id);
      return { success: true, applicationId: id, withdrawnOtherApplications: 0, skippedEarlierApplicants: 0 };
    });
    await svc.bulkAction('APPROVE', ['late', 'early', 'mid'], undefined, actor);
    expect(order).toEqual(['early', 'mid', 'late']);
  });

  it('refuses an already-decided application', async () => {
    const { svc } = setup({ appStatus: ApplicationStatus.APPROVED });
    await expect(svc.approve('a1', {}, actor)).rejects.toThrow(/already APPROVED/);
  });

  it('locks Student then Opportunity (same order as apply) before reading the seat count', async () => {
    const { svc, tx, lockOrder } = setup();
    await svc.approve('a1', {}, actor);
    expect(lockOrder).toEqual(['student', 'opportunity']);
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      tx.internshipOpportunity.findUnique.mock.invocationCallOrder[0],
    );
  });

  it("withdraws the student's other pending applications when one is approved", async () => {
    const { svc, tx } = setup({ withdrawn: 1 });
    const res = await svc.approve('a1', {}, actor);
    const call = tx.internshipApplication.updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ studentId: 's1', id: { not: 'a1' }, opportunityId: { not: null } });
    expect(call.where.status.in).toEqual(['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED']);
    expect(call.data.status).toBe('WITHDRAWN');
    expect(res.withdrawnOtherApplications).toBe(1);
  });

  it('refuses to approve a student who already has an approved internship', async () => {
    const { svc, tx } = setup({ alreadyPlaced: true });
    await expect(svc.approve('a1', {}, actor)).rejects.toThrow(/already has an approved internship/);
    expect(tx.internshipApplication.update).not.toHaveBeenCalled();
    expect(tx.internshipApplication.updateMany).not.toHaveBeenCalled();
  });
});

describe('OpportunityService.listApplications (first-come-first-served queue)', () => {
  const holder = (id: string, branchId: string, status: ApplicationStatus) => ({
    id, opportunityId: 'o1', status, student: { branchId, user: { branchId } },
  });

  function setup(items: any[], holders: any[]) {
    const prisma: any = {
      internshipApplication: {
        count: jest.fn().mockResolvedValue(items.length),
        // 1st call = the page, 2nd = every seat-holding applicant (already ordered by appliedDate)
        findMany: jest.fn().mockResolvedValueOnce(items).mockResolvedValueOnce(holders),
      },
      opportunityBranch: {
        findMany: jest.fn().mockResolvedValue([
          { opportunityId: 'o1', branchId: 'b-me', positions: 2, approvedCount: 1, maxApplications: 6 },
          { opportunityId: 'o1', branchId: 'b-ee', positions: 3, approvedCount: 0, maxApplications: null },
        ]),
      },
    };
    return { svc: new OpportunityService(prisma, {} as any, {} as any, {} as any), prisma };
  }
  const row = (id: string, branchId: string) => ({
    id, opportunity: { id: 'o1' }, student: { branchId, user: { branchId } },
  });

  it('ranks applicants per branch by application time and counts earlier pending ones', async () => {
    const holders = [
      holder('a1', 'b-me', ApplicationStatus.APPROVED), // first overall, ME, already selected
      holder('a2', 'b-ee', ApplicationStatus.APPLIED), // first EE
      holder('a3', 'b-me', ApplicationStatus.APPLIED), // 2nd ME, nobody pending ahead (a1 is approved)
      holder('a4', 'b-me', ApplicationStatus.APPLIED), // 3rd ME, a3 pending ahead
      holder('a5', 'b-ee', ApplicationStatus.SHORTLISTED), // 2nd EE, a2 pending ahead
    ];
    const items = ['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => row(id, id === 'a2' || id === 'a5' ? 'b-ee' : 'b-me'));
    const { svc } = setup(items, holders);
    const res = await svc.listApplications({ opportunityId: 'o1' } as any);
    const q = Object.fromEntries(res.data.map((d: any) => [d.id, d.queue]));
    expect(q.a1).toEqual({ rank: 1, pendingAhead: 0 });
    expect(q.a3).toEqual({ rank: 2, pendingAhead: 0 });
    expect(q.a4).toEqual({ rank: 3, pendingAhead: 1 });
    expect(q.a2).toEqual({ rank: 1, pendingAhead: 0 });
    expect(q.a5).toEqual({ rank: 2, pendingAhead: 1 });
  });

  it("attaches the branch's own seats (positions / selected / application limit)", async () => {
    const { svc } = setup([row('a1', 'b-me'), row('a2', 'b-ee')], []);
    const res = await svc.listApplications({} as any);
    expect(res.data[0].branchSeat).toEqual({ positions: 2, approvedCount: 1, applicationLimit: 6 });
    expect(res.data[1].branchSeat).toEqual({ positions: 3, approvedCount: 0, applicationLimit: 3 });
  });

  it('rejected / withdrawn applications have no queue position', async () => {
    const { svc } = setup([row('gone', 'b-me')], []);
    const res = await svc.listApplications({} as any);
    expect(res.data[0].queue).toBeNull();
  });

  it('orders the page by applied time, with id as the tie-break', async () => {
    const { svc, prisma } = setup([], []);
    await svc.listApplications({} as any);
    expect(prisma.internshipApplication.findMany.mock.calls[0][0].orderBy).toEqual([{ appliedDate: 'asc' }, { id: 'asc' }]);
  });
});
