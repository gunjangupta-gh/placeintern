import { ArgumentMetadata, BadRequestException, ConflictException, ValidationPipe } from '@nestjs/common';
import { OpportunityStatus } from '../../generated/prisma/client';
import { UpdateOpportunityDto } from './dto/opportunity.dto';
import { endOfDayIST, startOfDayIST } from './opportunity-dates.util';
import { OpportunityService } from './opportunity.service';

const actor = { userId: 'dir', role: 'STATE_DIRECTORATE' };
const day = (offset: number) => {
  const d = new Date(Date.now() + offset * 864e5);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
};
const iso = (c: { y: number; m: number; d: number }) => `${c.y}-${String(c.m).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`;

function setup(o: {
  deadlineOffset?: number; startOffset?: number; positions?: number; approvedCount?: number; applied?: number;
  holderBranches?: string[]; companyFound?: string | null; clash?: boolean; status?: OpportunityStatus;
  existingBranches?: Array<{ branchId: string; positions: number; approvedCount: number }>;
} = {}) {
  const existing = {
    id: 'o1', status: o.status ?? OpportunityStatus.OPEN, positions: o.positions ?? 10, approvedCount: o.approvedCount ?? 0,
    startDate: startOfDayIST(day(o.startOffset ?? 40)), applicationDeadline: endOfDayIST(day(o.deadlineOffset ?? 10)),
    companyId: 'c1', title: 'Fitter',
    branches: o.existingBranches ?? [{ branchId: 'b1', positions: o.positions ?? 10, approvedCount: o.approvedCount ?? 0 }],
  };
  const txUpdate = jest.fn().mockResolvedValue({ id: 'o1' });
  const txCompanyCreate = jest.fn().mockResolvedValue({ id: 'c-new' });
  const tx: any = { company: { create: txCompanyCreate }, internshipOpportunity: { update: txUpdate } };
  const prisma: any = {
    internshipOpportunity: {
      findFirst: jest.fn().mockImplementation(async (args: any) => {
        if (args.where?.id?.not) return o.clash ? { id: 'other' } : null; // duplicate check
        if (args.select?.companyId) return existing; // the record being edited
        return { // getOne at the end
          id: 'o1', title: 'x', positions: existing.positions, approvedCount: existing.approvedCount, status: existing.status,
          company: { id: 'c1', name: 'Godrej' }, branches: [],
        };
      }),
    },
    internshipApplication: {
      groupBy: jest.fn().mockResolvedValue(o.applied ? [{ opportunityId: 'o1', _count: { _all: o.applied } }] : []),
      // one row per seat-holding application: { opportunityId, student: { branchId } }
      findMany: jest.fn().mockResolvedValue((o.holderBranches ?? []).map((b) => ({ opportunityId: 'o1', student: { branchId: b, user: null } }))),
    },
    company: { findFirst: jest.fn().mockResolvedValue(o.companyFound ? { id: o.companyFound } : null) },
    branch: {
      count: jest.fn().mockImplementation(async ({ where }: any) => where.id.in.length),
      findMany: jest.fn().mockImplementation(async ({ where }: any) => where.id.in.map((id: string) => ({ id, name: `Branch ${id}` }))),
    },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)),
  };
  const svc = new OpportunityService(prisma, { invalidateByTags: jest.fn().mockResolvedValue(undefined) } as any, { log: jest.fn().mockResolvedValue(undefined) } as any, {} as any);
  return { svc, prisma, txUpdate, txCompanyCreate, existing };
}
const written = (m: jest.Mock) => m.mock.calls[0][0].data;

describe('OpportunityService.update (all fields editable)', () => {
  it('updates plain fields, trims text, and clears optional fields with an empty string', async () => {
    const { svc, txUpdate } = setup();
    await svc.update('o1', { title: '  Senior   Fitter ', description: '', stipend: '', district: ' Mohali ', contactEmail: '', durationMonths: 3 }, actor);
    expect(written(txUpdate)).toMatchObject({ title: 'Senior Fitter', description: null, stipend: null, district: 'Mohali', contactEmail: null, durationMonths: 3 });
  });

  it('rejects an empty title or company name', async () => {
    const { svc } = setup();
    await expect(svc.update('o1', { title: '   ' }, actor)).rejects.toThrow(/title cannot be empty/);
    await expect(svc.update('o1', { companyName: '   ' }, actor)).rejects.toThrow(/Company name cannot be empty/);
  });

  describe('deadline', () => {
    it('an EXPIRED opportunity can still be edited when the deadline is left as it is', async () => {
      const { svc, txUpdate, existing } = setup({ deadlineOffset: -5, startOffset: 20 });
      const unchanged = iso(day(-5));
      await expect(svc.update('o1', { title: 'New title', applicationDeadline: unchanged }, actor)).resolves.toBeDefined();
      expect(written(txUpdate).title).toBe('New title');
      expect(existing.applicationDeadline.getTime()).toBeLessThan(Date.now());
    });

    it('a CHANGED deadline in the past is rejected', async () => {
      const { svc } = setup();
      await expect(svc.update('o1', { applicationDeadline: iso(day(-3)) }, actor)).rejects.toThrow(/cannot be in the past/);
    });

    it('start date must stay after the deadline', async () => {
      const { svc } = setup();
      await expect(svc.update('o1', { startDate: iso(day(5)) }, actor)).rejects.toThrow(/after the application deadline/);
    });
  });

  describe('company', () => {
    it('links to an existing company (case-insensitive match) without creating one', async () => {
      const { svc, txUpdate, txCompanyCreate } = setup({ companyFound: 'c2' });
      await svc.update('o1', { companyName: 'hartek group' }, actor);
      expect(txCompanyCreate).not.toHaveBeenCalled();
      expect(written(txUpdate).company).toEqual({ connect: { id: 'c2' } });
    });

    it('creates a new company inside the same transaction as the update', async () => {
      const { svc, txUpdate, txCompanyCreate } = setup({ companyFound: null });
      await svc.update('o1', { companyName: 'Brand New Co' }, actor);
      expect(txCompanyCreate).toHaveBeenCalledWith({ data: { name: 'Brand New Co' }, select: { id: true } });
      expect(written(txUpdate).company).toEqual({ connect: { id: 'c-new' } });
    });

    it('does nothing to the company when the name already points at the same one', async () => {
      const { svc, txUpdate } = setup({ companyFound: 'c1' });
      await svc.update('o1', { companyName: 'Godrej' }, actor);
      expect(written(txUpdate).company).toBeUndefined();
    });
  });

  it('refuses an edit that would duplicate another opportunity', async () => {
    const { svc, txUpdate } = setup({ clash: true });
    await expect(svc.update('o1', { title: 'Production Trainee' }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(txUpdate).not.toHaveBeenCalled();
  });

  describe('branch-wise positions and application limits', () => {
    it('saves each branch with its own positions and application limit, and totals the positions', async () => {
      const { svc, txUpdate } = setup({ applied: 0 });
      await svc.update('o1', {
        branches: [
          { branchId: 'b1', positions: 5, maxApplications: 12 },
          { branchId: 'b2', positions: 3 },
        ],
      }, actor);
      const data = written(txUpdate);
      expect(data.positions).toBe(8);
      expect(data.branches.deleteMany).toEqual({ branchId: { notIn: ['b1', 'b2'] } });
      expect(data.branches.upsert).toHaveLength(2);
      expect(data.branches.upsert[0]).toMatchObject({
        create: { branchId: 'b1', positions: 5, maxApplications: 12 },
        update: { positions: 5, maxApplications: 12 },
      });
      expect(data.branches.upsert[1].update).toEqual({ positions: 3, maxApplications: null });
    });

    it('keeps the selected-student counts of existing branches (they are never overwritten)', async () => {
      const { svc, txUpdate } = setup({ existingBranches: [{ branchId: 'b1', positions: 5, approvedCount: 3 }] });
      await svc.update('o1', { branches: [{ branchId: 'b1', positions: 6 }] }, actor);
      const upsert = written(txUpdate).branches.upsert[0];
      expect(upsert.update).not.toHaveProperty('approvedCount');
      expect(written(txUpdate).approvedCount).toBe(3);
    });

    it("cannot drop a branch's positions below its selected students", async () => {
      const { svc, txUpdate } = setup({ existingBranches: [{ branchId: 'b1', positions: 5, approvedCount: 3 }] });
      await expect(svc.update('o1', { branches: [{ branchId: 'b1', positions: 2 }] }, actor)).rejects.toThrow(/Branch b1: positions cannot be less than the 3 student\(s\) already selected/);
      expect(txUpdate).not.toHaveBeenCalled();
    });

    it('the application limit cannot be below the positions', async () => {
      const { svc } = setup();
      await expect(svc.update('o1', { branches: [{ branchId: 'b1', positions: 5, maxApplications: 4 }] }, actor)).rejects.toThrow(/application limit cannot be less than the positions \(5\)/);
    });

    it("the limit (default = positions) cannot be below the branch's current applications", async () => {
      const { svc } = setup({ applied: 3, holderBranches: ['b1', 'b1', 'b1'] });
      await expect(svc.update('o1', { branches: [{ branchId: 'b1', positions: 2 }] }, actor)).rejects.toThrow(/below the 3 application\(s\) already received/);
      // ...but a higher explicit limit is fine, and applications of another branch do not count
      await expect(svc.update('o1', { branches: [{ branchId: 'b1', positions: 2, maxApplications: 5 }] }, actor)).resolves.toBeDefined();
    });

    it('a branch can only be listed once', async () => {
      const { svc } = setup();
      await expect(svc.update('o1', { branches: [{ branchId: 'b1', positions: 2 }, { branchId: 'b1', positions: 3 }] }, actor)).rejects.toThrow(/only be listed once/);
    });

    it('raising positions on a FILLED opportunity reopens it', async () => {
      const { svc, txUpdate } = setup({ positions: 10, approvedCount: 10, status: OpportunityStatus.FILLED });
      await svc.update('o1', { branches: [{ branchId: 'b1', positions: 15 }] }, actor);
      expect(written(txUpdate)).toMatchObject({ positions: 15, status: OpportunityStatus.OPEN });
    });

    it('is FILLED only when every branch has taken all its positions', async () => {
      const existingBranches = [
        { branchId: 'b1', positions: 5, approvedCount: 5 },
        { branchId: 'b2', positions: 3, approvedCount: 2 },
      ];
      const open = setup({ existingBranches });
      await open.svc.update('o1', { title: 'Fitter II' }, actor);
      expect(written(open.txUpdate).status).toBeUndefined(); // b2 still has a seat

      const filled = setup({ existingBranches });
      await filled.svc.update('o1', { branches: [{ branchId: 'b1', positions: 5 }, { branchId: 'b2', positions: 2 }] }, actor);
      expect(written(filled.txUpdate).status).toBe(OpportunityStatus.FILLED);
    });

    it('adding a branch to an opportunity with applicants is allowed', async () => {
      const { svc, txUpdate } = setup({ applied: 2, holderBranches: ['b1', 'b1'], existingBranches: [{ branchId: 'b1', positions: 5, approvedCount: 0 }] });
      await svc.update('o1', { branches: [{ branchId: 'b1', positions: 5 }, { branchId: 'b3', positions: 2 }] }, actor);
      expect(written(txUpdate).branches.upsert).toHaveLength(2);
      expect(written(txUpdate).positions).toBe(7);
    });

    it('removing a branch whose students have applied is refused and names it', async () => {
      const { svc, txUpdate } = setup({
        applied: 2, holderBranches: ['b1', 'b2'],
        existingBranches: [{ branchId: 'b1', positions: 5, approvedCount: 0 }, { branchId: 'b2', positions: 5, approvedCount: 0 }],
      });
      await expect(svc.update('o1', { branches: [{ branchId: 'b1', positions: 5 }, { branchId: 'b3', positions: 2 }] }, actor)).rejects.toThrow(/Cannot remove branch\(es\) Branch b2/);
      expect(txUpdate).not.toHaveBeenCalled();
    });

    it('removing a branch nobody applied from is allowed', async () => {
      const { svc } = setup({
        applied: 1, holderBranches: ['b1'],
        existingBranches: [{ branchId: 'b1', positions: 5, approvedCount: 0 }, { branchId: 'b2', positions: 5, approvedCount: 0 }],
      });
      await expect(svc.update('o1', { branches: [{ branchId: 'b1', positions: 5 }] }, actor)).resolves.toBeDefined();
    });
  });
});

describe('UpdateOpportunityDto (production pipe settings)', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const run = (value: any) => pipe.transform(value, { type: 'body', metatype: UpdateOpportunityDto } as ArgumentMetadata);

  it('accepts every editable field at once', async () => {
    await expect(run({
      companyName: 'Godrej', title: 'Fitter', description: 'd', district: 'Mohali', durationMonths: 6, stipend: '8000',
      startDate: '2027-01-15', applicationDeadline: '2026-12-15', status: 'OPEN', eligibleYears: [2, 3],
      branches: [{ branchId: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b', positions: 5, maxApplications: 8 }], contactName: 'HR', contactPhone: '+91 98765 43210', contactEmail: 'hr@x.in',
    })).resolves.toBeDefined();
  });

  it('allows empty strings to clear optional contact fields, but not the title or company', async () => {
    await expect(run({ contactPhone: '', contactEmail: '', contactName: '', description: '', stipend: '' })).resolves.toBeDefined();
    await expect(run({ title: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run({ companyName: '' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates each branch entry (positions >= 1, a real branch id, no unknown fields)', async () => {
    const id = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
    await expect(run({ branches: [{ branchId: id, positions: 0 }] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run({ branches: [{ branchId: 'nope', positions: 2 }] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run({ branches: [{ branchId: id, positions: 2, bogus: 1 }] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run({ branches: [] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run({ branches: [{ branchId: id, positions: 2, maxApplications: null }] })).resolves.toBeDefined();
  });

  it('rejects a malformed phone or email', async () => {
    await expect(run({ contactPhone: 'abc' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run({ contactEmail: 'not-an-email' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
