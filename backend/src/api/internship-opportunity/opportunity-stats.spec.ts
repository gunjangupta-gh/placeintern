import { OpportunityService } from './opportunity.service';

const me = { id: 'b-me', code: 'ME', name: 'Mechanical' };
const ee = { id: 'b-ee', code: 'EE', name: 'Electrical' };
const ce = { id: 'b-ce', code: 'CE', name: 'Civil' };

function setup(opps: any[], received = 0, waiting = 0) {
  const count = jest.fn().mockResolvedValueOnce(received).mockResolvedValueOnce(waiting);
  const prisma: any = {
    internshipOpportunity: { findMany: jest.fn().mockResolvedValue(opps) },
    internshipApplication: { count },
  };
  return { svc: new OpportunityService(prisma, {} as any, {} as any, {} as any), prisma };
}

describe('OpportunityService.stats (State dashboard cards)', () => {
  it('totals vacancies overall and per branch, largest branch first', async () => {
    const { svc } = setup([
      { status: 'OPEN', stipend: null, branches: [{ positions: 5, approvedCount: 1, stipend: null, branch: me }, { positions: 2, approvedCount: 0, stipend: null, branch: ee }] },
      { status: 'OPEN', stipend: null, branches: [{ positions: 8, approvedCount: 2, stipend: null, branch: me }, { positions: 3, approvedCount: 0, stipend: null, branch: ce }] },
      { status: 'FILLED', stipend: null, branches: [{ positions: 1, approvedCount: 1, stipend: null, branch: ee }] },
    ], 12, 9);
    const s = await svc.stats();
    expect(s).toMatchObject({ opportunities: 3, openOpportunities: 2, vacancies: 19, selected: 4, vacanciesLeft: 15 });
    expect(s.branchWise).toEqual([
      { code: 'ME', name: 'Mechanical', positions: 13, selected: 3 },
      { code: 'CE', name: 'Civil', positions: 3, selected: 0 },
      { code: 'EE', name: 'Electrical', positions: 3, selected: 1 },
    ]);
    expect(s.applications).toEqual({ received: 12, waiting: 9 });
  });

  it('averages the monthly stipend per vacancy, preferring the branch stipend over the opportunity one', async () => {
    const { svc } = setup([
      // ME 5 @ 8000 (branch), EE 5 @ 6000 (falls back to the opportunity stipend)
      { status: 'OPEN', stipend: '6000 per month', branches: [{ positions: 5, approvedCount: 0, stipend: '8000', branch: me }, { positions: 5, approvedCount: 0, stipend: null, branch: ee }] },
      // 10 vacancies at 10K
      { status: 'OPEN', stipend: '10K', branches: [{ positions: 10, approvedCount: 0, stipend: null, branch: ce }] },
    ]);
    const s = await svc.stats();
    expect(s.averageStipend).toBe(Math.round((5 * 8000 + 5 * 6000 + 10 * 10000) / 20)); // 8500
    expect(s.stipendCoverage).toEqual({ counted: 20, total: 20 });
  });

  it('leaves vacancies with no usable stipend out of the average and reports the coverage', async () => {
    const { svc } = setup([
      { status: 'OPEN', stipend: 'No', branches: [{ positions: 6, approvedCount: 0, stipend: null, branch: me }] },
      { status: 'OPEN', stipend: '9000 per month', branches: [{ positions: 4, approvedCount: 0, stipend: null, branch: ee }] },
    ]);
    const s = await svc.stats();
    expect(s.averageStipend).toBe(9000);
    expect(s.stipendCoverage).toEqual({ counted: 4, total: 10 });
  });

  it('has no average (null) when nothing has a stipend, and handles an empty list', async () => {
    expect((await setup([{ status: 'OPEN', stipend: null, branches: [{ positions: 3, approvedCount: 0, stipend: null, branch: me }] }]).svc.stats()).averageStipend).toBeNull();
    expect(await setup([]).svc.stats()).toMatchObject({ vacancies: 0, branchWise: [], averageStipend: null, opportunities: 0 });
  });

  it('only counts published internships (OPEN / FILLED, not deleted)', async () => {
    const { svc, prisma } = setup([]);
    await svc.stats();
    expect(prisma.internshipOpportunity.findMany.mock.calls[0][0].where).toEqual({ isDeleted: false, status: { in: ['OPEN', 'FILLED'] } });
  });
});
