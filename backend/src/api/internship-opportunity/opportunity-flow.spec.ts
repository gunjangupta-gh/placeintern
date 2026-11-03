import { BadRequestException } from '@nestjs/common';
import { ApplicationStatus, InternshipPhase, OpportunityStatus } from '../../generated/prisma/client';
import { OpportunityService } from './opportunity.service';
import { StudentOpportunityService } from './student-opportunity.service';

const future = new Date(Date.now() + 10 * 864e5);
const start = new Date(Date.now() + 40 * 864e5);

const completeStudent = {
  id: 's1', userId: 'u1', branchId: 'b-me', institutionId: 'i1', currentYear: 2,
  gender: 'MALE', category: 'GENERAL', admissionType: 'REGULAR', parentName: 'P', parentContact: '99',
  address: 'a', pinCode: '1', tehsil: 't', district: 'd', city: 'c', state: 's',
  user: { name: 'A', email: 'a@x.in', phoneNo: '98', dob: new Date('2005-01-01'), active: true, branchId: 'b-me' },
};

const opp = (over: any = {}) => ({
  id: 'o1', title: 'Production Trainee', positions: 10, status: OpportunityStatus.OPEN, isDeleted: false,
  eligibleYears: [], applicationDeadline: future, durationMonths: 6, stipend: '8000', startDate: start,
  company: { name: 'Godrej', address: 'Mohali' }, branches: [{ branchId: 'b-me' }], ...over,
});

describe('StudentOpportunityService.apply', () => {
  function setup(o: { seatsUsed?: number; other?: any; mine?: any; opportunity?: any; student?: any } = {}) {
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
        findFirst: jest.fn().mockImplementation(async ({ where }: any) =>
          where.opportunityId ? (o.mine ?? null) : (o.other ?? null)),
        create: jest.fn().mockResolvedValue({ id: 'app1', status: ApplicationStatus.APPLIED, opportunityId: 'o1' }),
      },
    };
    const prisma: any = { $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)) };
    const cache: any = { invalidateByTags: jest.fn().mockResolvedValue(undefined) };
    const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
    const elig: any = { getStudentContext: jest.fn().mockResolvedValue(completeStudent) };
    return { svc: new StudentOpportunityService(prisma, cache, audit, elig), tx, cache, lockOrder };
  }

  it('creates an APPLIED application, snapshots company data, and holds no contact fields', async () => {
    const { svc, tx, cache } = setup();
    const res = await svc.apply('u1', 'o1');
    expect(res).toEqual({ applicationId: 'app1', status: 'APPLIED' });

    const data = tx.internshipApplication.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      studentId: 's1', opportunityId: 'o1', isSelfIdentified: false, status: 'APPLIED',
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

  it('10 seats: 9 used -> allowed, 10 used -> blocked and nothing is created', async () => {
    const ok = setup({ seatsUsed: 9 });
    await expect(ok.svc.apply('u1', 'o1')).resolves.toBeDefined();

    const full = setup({ seatsUsed: 10 });
    await expect(full.svc.apply('u1', 'o1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'APPLICATIONS_FULL' }),
    });
    expect(full.tx.internshipApplication.create).not.toHaveBeenCalled();
  });

  it('allows only one application per student', async () => {
    const { svc, tx } = setup({ other: { id: 'x' } });
    await expect(svc.apply('u1', 'o1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'HAS_ACTIVE_APPLICATION' }),
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

    const wrongBranch = setup({ opportunity: opp({ branches: [{ branchId: 'b-civil' }] }) });
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
  function setup(o: { approvedCount?: number; positions?: number; appStatus?: ApplicationStatus } = {}) {
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      internshipApplication: {
        findUnique: jest.fn().mockImplementation(async ({ select }: any) =>
          select.opportunityId
            ? { opportunityId: 'o1' }
            : { id: 'a1', studentId: 's1', status: o.appStatus ?? ApplicationStatus.APPLIED, startDate: start, endDate: null }),
        update: jest.fn().mockResolvedValue({}),
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
    return { svc: new OpportunityService(prisma, cache, audit, expected), tx, expected };
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
    expect(tx.internshipOpportunity.update.mock.calls[0][0].data).toEqual({ approvedCount: 4 });
    expect(expected.recalculateExpectedCounts).toHaveBeenCalledWith('a1');
  });

  it('marks the opportunity FILLED when the last position is approved', async () => {
    const { svc, tx } = setup({ approvedCount: 9, positions: 10 });
    await svc.approve('a1', {}, actor);
    expect(tx.internshipOpportunity.update.mock.calls[0][0].data).toEqual({
      approvedCount: 10, status: OpportunityStatus.FILLED,
    });
  });

  it('refuses to over-approve beyond positions', async () => {
    const { svc, tx } = setup({ approvedCount: 10, positions: 10 });
    await expect(svc.approve('a1', {}, actor)).rejects.toThrow(/already filled/);
    expect(tx.internshipApplication.update).not.toHaveBeenCalled();
  });

  it('refuses an already-decided application', async () => {
    const { svc } = setup({ appStatus: ApplicationStatus.APPROVED });
    await expect(svc.approve('a1', {}, actor)).rejects.toThrow(/already APPROVED/);
  });

  it('takes the opportunity row lock before reading the seat count', async () => {
    const { svc, tx } = setup();
    await svc.approve('a1', {}, actor);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.internshipOpportunity.findUnique.mock.invocationCallOrder[0],
    );
  });
});
