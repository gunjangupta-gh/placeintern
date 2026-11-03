import { BadRequestException, ConflictException } from '@nestjs/common';
import { OpportunityStatus } from '../../generated/prisma/client';
import { OpportunityService } from './opportunity.service';

const actor = { userId: 'dir', role: 'STATE_DIRECTORATE' };
const iso = (offset: number) => {
  const d = new Date(Date.now() + offset * 864e5);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const valid = (over: any = {}) => ({
  companyName: '  Godrej   Industries ',
  title: ' Production  Trainee ',
  durationMonths: 6,
  stipend: '8000',
  startDate: iso(40),
  applicationDeadline: iso(10),
  branches: [
    { branchId: 'b1', positions: 5, maxApplications: 12, stipend: ' 9000 ' },
    { branchId: 'b2', positions: 3 },
  ],
  ...over,
});

function setup(o: { companyFound?: boolean; clash?: boolean; branchesKnown?: string[] } = {}) {
  const txOppCreate = jest.fn().mockResolvedValue({ id: 'new1' });
  const txCompanyCreate = jest.fn().mockResolvedValue({ id: 'c-new' });
  const tx: any = { company: { create: txCompanyCreate }, internshipOpportunity: { create: txOppCreate } };
  const known = o.branchesKnown ?? ['b1', 'b2'];
  const prisma: any = {
    branch: { findMany: jest.fn().mockImplementation(async ({ where }: any) => known.filter((id) => where.id.in.includes(id)).map((id) => ({ id, name: `Branch ${id}` }))) },
    company: { findFirst: jest.fn().mockResolvedValue(o.companyFound ? { id: 'c1' } : null) },
    internshipOpportunity: {
      findFirst: jest.fn().mockImplementation(async (args: any) =>
        args.select?.id && args.where?.title ? (o.clash ? { id: 'other' } : null) : {
          id: 'new1', title: 'x', positions: 8, approvedCount: 0, status: 'OPEN', company: { id: 'c', name: 'G' }, branches: [],
        }),
    },
    internshipApplication: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)),
  };
  const svc = new OpportunityService(prisma, { invalidateByTags: jest.fn().mockResolvedValue(undefined) } as any, { log: jest.fn().mockResolvedValue(undefined) } as any, {} as any);
  return { svc, prisma, txOppCreate, txCompanyCreate };
}
const data = (m: jest.Mock) => m.mock.calls[0][0].data;

describe('OpportunityService.create (form)', () => {
  it('creates the opportunity with branch-wise positions, limits and stipend, and totals the positions', async () => {
    const { svc, txOppCreate, txCompanyCreate } = setup();
    await svc.create(valid() as any, actor);
    expect(txCompanyCreate).toHaveBeenCalledWith({ data: { name: 'Godrej Industries' }, select: { id: true } });
    const d = data(txOppCreate);
    expect(d).toMatchObject({
      companyId: 'c-new', title: 'Production Trainee', positions: 8, stipend: '8000',
      status: OpportunityStatus.OPEN, createdById: 'dir', durationMonths: 6, eligibleYears: [],
    });
    expect(d.branches.create).toEqual([
      { branchId: 'b1', positions: 5, maxApplications: 12, stipend: '9000' },
      { branchId: 'b2', positions: 3, maxApplications: null, stipend: null },
    ]);
  });

  it('reuses an existing company (case-insensitive) instead of creating one', async () => {
    const { svc, txOppCreate, txCompanyCreate } = setup({ companyFound: true });
    await svc.create(valid() as any, actor);
    expect(txCompanyCreate).not.toHaveBeenCalled();
    expect(data(txOppCreate).companyId).toBe('c1');
  });

  it('can be saved as DRAFT', async () => {
    const { svc, txOppCreate } = setup();
    await svc.create(valid({ status: 'DRAFT' }) as any, actor);
    expect(data(txOppCreate).status).toBe(OpportunityStatus.DRAFT);
  });

  it('refuses a duplicate (same company, position and start date)', async () => {
    const { svc, txOppCreate } = setup({ companyFound: true, clash: true });
    await expect(svc.create(valid() as any, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(txOppCreate).not.toHaveBeenCalled();
  });

  it.each([
    [{ applicationDeadline: iso(-2) }, /cannot be in the past/],
    [{ applicationDeadline: iso(10), startDate: iso(10) }, /Start date must be after/],
    [{ branches: [{ branchId: 'b1', positions: 2 }, { branchId: 'b1', positions: 3 }] }, /only be listed once/],
    [{ branches: [{ branchId: 'b1', positions: 5, maxApplications: 4 }] }, /application limit cannot be less than the positions \(5\)/],
    [{ branches: [{ branchId: 'zzz', positions: 2 }] }, /branches are invalid/],
    [{ title: '   ' }, /title cannot be empty/],
  ])('rejects invalid input %#', async (over: any, msg) => {
    const { svc, txOppCreate } = setup();
    await expect(svc.create(valid(over) as any, actor)).rejects.toThrow(msg);
    await expect(svc.create(valid(over) as any, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(txOppCreate).not.toHaveBeenCalled();
  });
});
