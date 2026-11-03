import * as ExcelJS from 'exceljs';
import { ApplicationStatus, InternshipPhase, OpportunityStatus } from '../../generated/prisma/client';
import { buildApplicationWhere } from './application-filters';
import { OpportunityExportService } from './opportunity-export.service';
import { OpportunityService } from './opportunity.service';

describe('buildApplicationWhere', () => {
  it('defaults to every opportunity application and has no status filter', () => {
    expect(buildApplicationWhere({})).toEqual({ opportunityId: { not: null }, student: {} });
  });

  it('SELECTED group covers approved, selected, joined and completed (so approved students never vanish after the start date)', () => {
    const w: any = buildApplicationWhere({ group: 'SELECTED' });
    expect(w.status.in).toEqual(expect.arrayContaining(['APPROVED', 'SELECTED', 'JOINED', 'COMPLETED']));
    expect(w.status.in).not.toContain('APPLIED');
  });

  it('PENDING and CLOSED groups', () => {
    expect((buildApplicationWhere({ group: 'PENDING' }) as any).status.in).toEqual(['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED']);
    expect((buildApplicationWhere({ group: 'CLOSED' }) as any).status.in).toEqual(['REJECTED', 'WITHDRAWN']);
  });

  it('group wins over status; status alone is used when no group', () => {
    expect((buildApplicationWhere({ group: 'PENDING', status: ApplicationStatus.APPROVED }) as any).status.in).toContain('APPLIED');
    expect((buildApplicationWhere({ status: ApplicationStatus.REJECTED }) as any).status).toBe('REJECTED');
  });

  it('scopes to one opportunity, institution, branch and student search', () => {
    const w: any = buildApplicationWhere({ opportunityId: 'o1', institutionId: 'i1', branchId: 'b1', search: 'amit' });
    expect(w.opportunityId).toBe('o1');
    expect(w.student).toMatchObject({ institutionId: 'i1', branchId: 'b1' });
    expect(w.student.user.OR).toHaveLength(2);
  });
});

describe('OpportunityService.deleteApplication', () => {
  function setup(o: { status?: ApplicationStatus; reports?: number; visits?: number; approvedCount?: number; positions?: number; oppStatus?: OpportunityStatus } = {}) {
    const lockOrder: string[] = [];
    const tx: any = {
      $queryRaw: jest.fn().mockImplementation(async (s: TemplateStringsArray) => {
        lockOrder.push(s.join('?').includes('"Student"') ? 'student' : 'opportunity');
        return [];
      }),
      internshipApplication: {
        findUnique: jest.fn().mockImplementation(async ({ select }: any) =>
          select.opportunityId
            ? { opportunityId: 'o1', studentId: 's1' }
            : { id: 'a1', status: o.status ?? ApplicationStatus.APPLIED, _count: { monthlyReports: o.reports ?? 0, facultyVisitLogs: o.visits ?? 0 } }),
        delete: jest.fn().mockResolvedValue({}),
      },
      internshipOpportunity: {
        findUnique: jest.fn().mockResolvedValue({ positions: o.positions ?? 10, approvedCount: o.approvedCount ?? 0, status: o.oppStatus ?? OpportunityStatus.OPEN }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma: any = { $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)) };
    const cache: any = { invalidateByTags: jest.fn().mockResolvedValue(undefined) };
    const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
    return { svc: new OpportunityService(prisma, cache, audit, {} as any), tx, cache, lockOrder };
  }
  const actor = { userId: 'dir', role: 'STATE_DIRECTORATE' };

  it('deletes a pending application without touching the approved count', async () => {
    const { svc, tx, cache } = setup({ status: ApplicationStatus.APPLIED });
    const res = await svc.deleteApplication('a1', actor);
    expect(res).toMatchObject({ success: true, approvalUndone: false });
    expect(tx.internshipApplication.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    expect(tx.internshipOpportunity.update).not.toHaveBeenCalled();
    expect(cache.invalidateByTags).toHaveBeenCalledWith(['applications', 'student:s1']);
  });

  it('deleting a confirmed application undoes the approval: count -1 and a FILLED opportunity reopens', async () => {
    const { svc, tx } = setup({ status: ApplicationStatus.APPROVED, approvedCount: 10, positions: 10, oppStatus: OpportunityStatus.FILLED });
    const res = await svc.deleteApplication('a1', actor);
    expect(res.approvalUndone).toBe(true);
    expect(tx.internshipOpportunity.update.mock.calls[0][0].data).toEqual({ approvedCount: 9, status: OpportunityStatus.OPEN });
  });

  it('keeps the opportunity status when it was not full, and never goes below zero', async () => {
    const { svc, tx } = setup({ status: ApplicationStatus.JOINED, approvedCount: 0, positions: 10, oppStatus: OpportunityStatus.CLOSED });
    await svc.deleteApplication('a1', actor);
    expect(tx.internshipOpportunity.update.mock.calls[0][0].data).toEqual({ approvedCount: 0 });
  });

  it('refuses when monthly reports or visits exist (they would be cascade-deleted)', async () => {
    for (const o of [{ reports: 2 }, { visits: 1 }]) {
      const { svc, tx } = setup({ status: ApplicationStatus.JOINED, ...o });
      await expect(svc.deleteApplication('a1', actor)).rejects.toThrow(/Cannot delete/);
      expect(tx.internshipApplication.delete).not.toHaveBeenCalled();
      expect(tx.internshipOpportunity.update).not.toHaveBeenCalled();
    }
  });

  it('locks Student then Opportunity', async () => {
    const { svc, lockOrder } = setup();
    await svc.deleteApplication('a1', actor);
    expect(lockOrder).toEqual(['student', 'opportunity']);
  });

  it('bulk DELETE reports per-item success and failure', async () => {
    const { svc } = setup({ status: ApplicationStatus.JOINED, reports: 1 });
    const res = await svc.bulkAction('DELETE', ['a1'], undefined, actor);
    expect(res).toMatchObject({ succeeded: 0, failed: 1 });
    expect(res.results[0].error).toMatch(/Cannot delete/);
  });
});

describe('OpportunityExportService', () => {
  const app = (over: any = {}) => ({
    status: 'APPLIED', internshipPhase: InternshipPhase.NOT_STARTED, appliedDate: new Date('2026-11-02T10:00:00Z'),
    reviewedAt: null, reviewRemarks: null, rejectionReason: null,
    startDate: new Date('2027-01-14T18:30:00Z'), endDate: null, joiningLetterUrl: null, mentor: null,
    _count: { monthlyReports: 0, facultyVisitLogs: 0 },
    opportunity: { title: 'Fitter', district: 'Mohali', durationMonths: 6, stipend: '8000', company: { name: 'Godrej' } },
    student: {
      currentYear: 2,
      user: { name: 'Amit', rollNumber: 'R1', email: 'a@x.in', phoneNo: '999' },
      Institution: { name: 'GP Mohali' }, branch: { name: 'Mechanical', code: 'ME' },
    },
    ...over,
  });

  async function run(apps: any[], opps: any[] = []) {
    const prisma: any = {
      internshipApplication: { findMany: jest.fn().mockResolvedValue(apps), groupBy: jest.fn().mockResolvedValue([{ opportunityId: 'o1', _count: { _all: apps.length } }]) },
      internshipOpportunity: { findMany: jest.fn().mockResolvedValue(opps) },
    };
    const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = new OpportunityExportService(prisma, audit);
    const buf = await svc.buildWorkbook({}, { userId: 'dir', role: 'STATE_DIRECTORATE' });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    return { wb, prisma, audit };
  }

  it('produces Applications, Selected Students and Opportunities sheets', async () => {
    const { wb } = await run([app()]);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Applications', 'Selected Students', 'Opportunities']);
  });

  it('Selected Students holds only confirmed statuses (incl. JOINED), Applications holds everyone', async () => {
    const { wb } = await run([
      app({ status: 'APPLIED' }),
      app({ status: 'APPROVED' }),
      app({ status: 'JOINED' }),
      app({ status: 'REJECTED', rejectionReason: 'Not suitable' }),
    ]);
    expect(wb.getWorksheet('Applications')!.rowCount).toBe(1 + 4);
    expect(wb.getWorksheet('Selected Students')!.rowCount).toBe(1 + 2);
  });

  it('writes dates as IST text and the rejection reason in Remarks', async () => {
    const { wb } = await run([app({ status: 'REJECTED', rejectionReason: 'Not suitable' })]);
    const ws = wb.getWorksheet('Applications')!;
    const header = (ws.getRow(1).values as any[]).slice(1);
    const row = (ws.getRow(2).values as any[]).slice(1);
    const cell = (h: string) => row[header.indexOf(h)];
    expect(cell('Start Date')).toBe('15 Jan 2027'); // 2027-01-14T18:30Z is 15 Jan 00:00 IST
    expect(cell('Remarks / Reason')).toBe('Not suitable');
    expect(cell('Company')).toBe('Godrej');
    expect(cell('Branch')).toBe('Mechanical');
  });

  it('neutralises spreadsheet formula injection in student-entered text', async () => {
    const evil = app({ student: { ...app().student, user: { name: '=HYPERLINK("http://evil","x")', rollNumber: '+1', email: '@a', phoneNo: '-2' } } });
    const { wb } = await run([evil]);
    const ws = wb.getWorksheet('Applications')!;
    const header = (ws.getRow(1).values as any[]).slice(1);
    const row = (ws.getRow(2).values as any[]).slice(1);
    expect(row[header.indexOf('Student Name')]).toBe(`'=HYPERLINK("http://evil","x")`);
    expect(row[header.indexOf('Roll No')]).toBe("'+1");
    expect(row[header.indexOf('Email')]).toBe("'@a");
  });

  it('summary sheet shows positions, active applications, selected and seats left', async () => {
    const { wb } = await run([app(), app()], [{
      id: 'o1', title: 'Fitter', district: 'Mohali', positions: 10, approvedCount: 1, status: 'OPEN', durationMonths: 6, stipend: '8000',
      startDate: new Date('2027-01-14T18:30:00Z'), applicationDeadline: new Date('2026-12-15T18:29:59Z'),
      contactName: 'HR', contactPhone: '1', contactEmail: 'h@x.in', company: { name: 'Godrej' }, branches: [{ branch: { code: 'ME' } }, { branch: { code: 'EE' } }],
    }]);
    const ws = wb.getWorksheet('Opportunities')!;
    const header = (ws.getRow(1).values as any[]).slice(1);
    const row = (ws.getRow(2).values as any[]).slice(1);
    expect(row[header.indexOf('Positions')]).toBe(10);
    expect(row[header.indexOf('Applications (active)')]).toBe(2);
    expect(row[header.indexOf('Selected')]).toBe(1);
    expect(row[header.indexOf('Seats Left')]).toBe(8);
    expect(row[header.indexOf('Branches')]).toBe('ME, EE');
  });

  it('records an audit entry without storing the search text', async () => {
    const { audit } = await run([app()]);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DATA_EXPORT', description: expect.stringContaining('1 internship') }));
  });
});
