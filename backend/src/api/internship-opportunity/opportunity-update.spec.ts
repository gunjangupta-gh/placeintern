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
} = {}) {
  const existing = {
    id: 'o1', status: o.status ?? OpportunityStatus.OPEN, positions: o.positions ?? 10, approvedCount: o.approvedCount ?? 0,
    startDate: startOfDayIST(day(o.startOffset ?? 40)), applicationDeadline: endOfDayIST(day(o.deadlineOffset ?? 10)),
    companyId: 'c1', title: 'Fitter',
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
      findMany: jest.fn().mockResolvedValue((o.holderBranches ?? []).map((b) => ({ student: { branchId: b } }))),
    },
    company: { findFirst: jest.fn().mockResolvedValue(o.companyFound ? { id: o.companyFound } : null) },
    branch: {
      count: jest.fn().mockImplementation(async ({ where }: any) => where.id.in.length),
      findMany: jest.fn().mockImplementation(async ({ where }: any) => where.id.in.map((id: string) => ({ name: `Branch ${id}` }))),
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

  describe('positions', () => {
    it('cannot drop below current applications or approved students', async () => {
      const { svc } = setup({ applied: 4, approvedCount: 2 });
      await expect(svc.update('o1', { positions: 3 }, actor)).rejects.toThrow(/cannot be less than current applications \(4\)/);
    });

    it('raising positions on a FILLED opportunity reopens it', async () => {
      const { svc, txUpdate } = setup({ positions: 10, approvedCount: 10, applied: 10, status: OpportunityStatus.FILLED });
      await svc.update('o1', { positions: 15 }, actor);
      expect(written(txUpdate)).toMatchObject({ positions: 15, status: OpportunityStatus.OPEN });
    });
  });

  describe('eligible branches', () => {
    it('can be changed freely while nobody has applied', async () => {
      const { svc, txUpdate } = setup({ applied: 0 });
      await svc.update('o1', { branchIds: ['b1', 'b2'] }, actor);
      expect(written(txUpdate).branches).toEqual({ deleteMany: {}, create: [{ branchId: 'b1' }, { branchId: 'b2' }] });
    });

    it('with applicants: adding branches is allowed, keeping all applicant branches', async () => {
      const { svc, txUpdate } = setup({ applied: 2, holderBranches: ['b1', 'b2'] });
      await svc.update('o1', { branchIds: ['b1', 'b2', 'b3'] }, actor);
      expect(written(txUpdate).branches.create).toHaveLength(3);
    });

    it('with applicants: removing a branch that an applicant belongs to is refused and names it', async () => {
      const { svc, txUpdate } = setup({ applied: 2, holderBranches: ['b1', 'b2'] });
      await expect(svc.update('o1', { branchIds: ['b1', 'b3'] }, actor)).rejects.toThrow(/Cannot remove branch\(es\) Branch b2/);
      expect(txUpdate).not.toHaveBeenCalled();
    });

    it('with applicants: removing a branch nobody applied from is allowed', async () => {
      const { svc } = setup({ applied: 1, holderBranches: ['b1'] });
      await expect(svc.update('o1', { branchIds: ['b1'] }, actor)).resolves.toBeDefined();
    });
  });
});

describe('UpdateOpportunityDto (production pipe settings)', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const run = (value: any) => pipe.transform(value, { type: 'body', metatype: UpdateOpportunityDto } as ArgumentMetadata);

  it('accepts every editable field at once', async () => {
    await expect(run({
      companyName: 'Godrej', title: 'Fitter', description: 'd', district: 'Mohali', positions: 5, durationMonths: 6, stipend: '8000',
      startDate: '2027-01-15', applicationDeadline: '2026-12-15', status: 'OPEN', eligibleYears: [2, 3],
      branchIds: ['3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'], contactName: 'HR', contactPhone: '+91 98765 43210', contactEmail: 'hr@x.in',
    })).resolves.toBeDefined();
  });

  it('allows empty strings to clear optional contact fields, but not the title or company', async () => {
    await expect(run({ contactPhone: '', contactEmail: '', contactName: '', description: '', stipend: '' })).resolves.toBeDefined();
    await expect(run({ title: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run({ companyName: '' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a malformed phone or email', async () => {
    await expect(run({ contactPhone: 'abc' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run({ contactEmail: 'not-an-email' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
