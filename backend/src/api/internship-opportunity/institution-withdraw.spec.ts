import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, Role } from '../../generated/prisma/client';
import { InstitutionOpportunityService } from './institution-opportunity.service';

const mentor = { userId: 'm1', role: Role.TEACHER, institutionId: 'i1' };

function setup(o: { app?: any | null; updated?: number } = {}) {
  const app = o.app === undefined
    ? { id: 'a1', status: ApplicationStatus.APPLIED, studentId: 's1', student: { institutionId: 'i1', user: { name: 'Amit' } } }
    : o.app;
  const prisma: any = {
    internshipApplication: {
      findFirst: jest.fn().mockResolvedValue(app),
      updateMany: jest.fn().mockResolvedValue({ count: o.updated ?? 1 }),
    },
  };
  const cache: any = { invalidateByTags: jest.fn().mockResolvedValue(undefined) };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  return { svc: new InstitutionOpportunityService(prisma, cache, audit), prisma, cache, audit };
}

describe('InstitutionOpportunityService.withdrawApplication (faculty mentor)', () => {
  it("withdraws a mentee's pending application, frees it, and records who and why", async () => {
    const { svc, prisma, cache, audit } = setup();
    await expect(svc.withdrawApplication(mentor, 'a1', ' Student asked ')).resolves.toEqual({ success: true, applicationId: 'a1' });
    const call = prisma.internshipApplication.updateMany.mock.calls[0][0];
    expect(call.where.status.in).toEqual(['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED']);
    expect(call.data).toMatchObject({ status: 'WITHDRAWN', isSelected: false, reviewRemarks: 'Withdrawn by mentor: Student asked' });
    expect(cache.invalidateByTags).toHaveBeenCalledWith(['applications', 'student:s1']);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'APPLICATION_WITHDRAW', userId: 'm1' }));
  });

  it('works without a reason', async () => {
    const { svc, prisma } = setup();
    await svc.withdrawApplication(mentor, 'a1');
    expect(prisma.internshipApplication.updateMany.mock.calls[0][0].data.reviewRemarks).toBe('Withdrawn by mentor');
  });

  it("only looks within the mentor's own active mentees (anything else is 'not found')", async () => {
    const { svc, prisma } = setup({ app: null });
    await expect(svc.withdrawApplication(mentor, 'a1')).rejects.toBeInstanceOf(NotFoundException);
    const where = prisma.internshipApplication.findFirst.mock.calls[0][0].where;
    expect(where.student).toMatchObject({ mentorAssignments: { some: { mentorId: 'm1', isActive: true } } });
    expect(where.opportunityId).toEqual({ not: null }); // never a self-identified internship
    expect(prisma.internshipApplication.updateMany).not.toHaveBeenCalled();
  });

  it.each(['APPROVED', 'SELECTED', 'JOINED', 'COMPLETED', 'REJECTED', 'WITHDRAWN'])('refuses a decided application (%s)', async (status) => {
    const { svc, prisma } = setup({ app: { id: 'a1', status, studentId: 's1', student: null } });
    await expect(svc.withdrawApplication(mentor, 'a1')).rejects.toThrow(/Only pending applications can be withdrawn/);
    expect(prisma.internshipApplication.updateMany).not.toHaveBeenCalled();
  });

  it('reports a conflict when the Directorate decided at the same moment', async () => {
    const { svc } = setup({ updated: 0 });
    await expect(svc.withdrawApplication(mentor, 'a1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('the principal cannot use it', async () => {
    const { svc, prisma } = setup();
    await expect(svc.withdrawApplication({ userId: 'p1', role: Role.PRINCIPAL, institutionId: 'i1' }, 'a1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.internshipApplication.findFirst).not.toHaveBeenCalled();
  });
});
