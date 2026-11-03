import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { OpportunityImportService, OPPORTUNITY_SHEET } from './opportunity-import.service';

const BRANCHES = [
  { id: 'b-me', code: 'ME', name: 'Mechanical Engineering', shortName: 'Mech' },
  { id: 'b-ee', code: 'EE', name: 'Electrical Engineering', shortName: 'Elect' },
  // two branches sharing a short name -> ambiguous when matched by short name
  { id: 'b-cs1', code: 'CSE1', name: 'Computer Science A', shortName: 'CS' },
  { id: 'b-cs2', code: 'CSE2', name: 'Computer Science B', shortName: 'CS' },
];

const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

type Row = Partial<{
  company: any; district: any; title: any; positions: any; branches: any; years: any; duration: any;
  stipend: any; start: any; deadline: any; description: any; cName: any; cPhone: any; cEmail: any;
}>;

const good = (over: Row = {}): Row => ({
  company: 'Godrej', district: 'Mohali', title: 'Production Trainee', positions: 10, branches: 'ME, EE',
  years: '2,3', duration: 6, stipend: '8000', start: day(40), deadline: day(10), ...over,
});

describe('OpportunityImportService', () => {
  let service: OpportunityImportService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      branch: { findMany: jest.fn().mockResolvedValue(BRANCHES) },
      company: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Godrej' }]) },
      internshipOpportunity: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new OpportunityImportService(prisma, { log: jest.fn().mockResolvedValue(undefined) } as any);
  });

  /** Builds a file from the REAL generated template, then appends rows. */
  async function fileWith(rows: Row[], mutate?: (wb: ExcelJS.Workbook) => void): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await service.getTemplate()) as any);
    const ws = wb.getWorksheet(OPPORTUNITY_SHEET)!;
    rows.forEach((r, i) => {
      // Set by explicit column index (a dense [undefined, ...] array would shift everything left)
      [r.company, r.district, r.title, r.positions, r.branches, r.years, r.duration,
        r.stipend, r.start, r.deadline, r.description, r.cName, r.cPhone, r.cEmail,
      ].forEach((v, c) => {
        if (v !== undefined && v !== null) ws.getCell(i + 2, c + 1).value = v;
      });
    });
    mutate?.(wb);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  const errorsFor = (res: any, row: number) => res.errors.find((e: any) => e.row === row)?.messages ?? [];

  describe('template', () => {
    it('contains the three sheets, the active branches and the validated columns', async () => {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load((await service.getTemplate()) as any);
      expect(wb.worksheets.map((w) => w.name)).toEqual([OPPORTUNITY_SHEET, 'Branches', 'Instructions']);
      expect(wb.getWorksheet('Branches')!.rowCount).toBe(BRANCHES.length + 1);
      const ws = wb.getWorksheet(OPPORTUNITY_SHEET)!;
      expect(ws.getCell('D2').dataValidation?.type).toBe('whole'); // positions
      expect(ws.getCell('I2').dataValidation?.type).toBe('date'); // start date
    });
  });

  describe('validate', () => {
    it('accepts a good row and resolves branch ids', async () => {
      const res = await service.validate(await fileWith([good()]));
      expect(res).toMatchObject({ totalRows: 1, validRows: 1, invalidRows: 0 });
      expect(res.rows[0].branchIds).toEqual(['b-me', 'b-ee']);
      expect(res.rows[0].eligibleYears).toEqual([2, 3]);
      expect(res.newCompanies).toEqual([]);
    });

    it('flags unknown companies as new, matched case-insensitively', async () => {
      const res = await service.validate(await fileWith([good({ company: 'godrej' }), good({ company: 'Hartek', title: 'Fitter' })]));
      expect(res.newCompanies).toEqual(['Hartek']);
    });

    it.each([
      [0, 'between 1 and'],
      [-3, 'whole number'],
      [10.5, 'whole number'],
      ['ten', 'whole number'],
      [501, 'between 1 and'],
      [null, 'required'],
    ])('rejects positions=%p', async (value, msg) => {
      const res = await service.validate(await fileWith([good({ positions: value })]));
      expect(errorsFor(res, 2).join(' ')).toContain(msg);
    });

    it('rejects unknown branches and ambiguous branch names (exact match only)', async () => {
      const res = await service.validate(
        await fileWith([good({ branches: 'ME, Plumbing' }), good({ title: 'B', branches: 'CS' })]),
      );
      expect(errorsFor(res, 2).join(' ')).toContain('Unknown branch(es): Plumbing');
      expect(errorsFor(res, 3).join(' ')).toContain('Ambiguous');
    });

    describe('branch-wise positions', () => {
      const one = async (over: any) => {
        const res = await service.validate(await fileWith([good(over)]));
        return { res, errors: errorsFor(res, 2).join(' | ') };
      };

      it('reads CODE:positions and CODE:positions/limit and totals the positions', async () => {
        const { res } = await one({ positions: '', branches: 'ME:6, EE:4/10' });
        expect(res.rows[0]).toMatchObject({ positions: 10, branchIds: ['b-me', 'b-ee'] });
        expect(res.rows[0].branchSeats).toEqual([
          { branchId: 'b-me', code: 'ME', positions: 6, maxApplications: null },
          { branchId: 'b-ee', code: 'EE', positions: 4, maxApplications: 10 },
        ]);
      });

      it('treats a limit equal to the positions as "no extra limit"', async () => {
        const { res } = await one({ positions: '', branches: 'ME:5/5' });
        expect(res.rows[0].branchSeats[0].maxApplications).toBeNull();
      });

      it('splits a total equally across branches, remainder to the first ones', async () => {
        const { res } = await one({ positions: 7, branches: 'ME, EE' });
        expect(res.rows[0].branchSeats.map((b: any) => b.positions)).toEqual([4, 3]);
      });

      it('a single branch takes the whole total', async () => {
        const { res } = await one({ positions: 9, branches: 'ME' });
        expect(res.rows[0].branchSeats[0].positions).toBe(9);
      });

      it('an explicit total must equal the branch-wise sum', async () => {
        const { res, errors } = await one({ positions: 9, branches: 'ME:6, EE:4' });
        expect(res.validRows).toBe(0);
        expect(errors).toContain('does not match the branch-wise total (10)');
      });

      it.each([
        ['ME:5, EE', 'Give positions for every branch'],
        ['ME:five', 'must look like ME:5 or ME:5/12'],
        ['ME:0', 'ME: positions must be between 1 and'],
        ['ME:5/3', 'ME: the application limit (3) cannot be less than the positions (5)'],
        ['ME:3, ME:2', 'listed more than once'],
        ['ME:3, Plumbing:2', 'Unknown branch(es): Plumbing'],
      ])('rejects %p', async (branches, msg) => {
        const { res, errors } = await one({ positions: '', branches });
        expect(res.validRows).toBe(0);
        expect(errors).toContain(msg);
      });

      it('needs a total when no branch has its own count, and at least one position per branch', async () => {
        expect((await one({ positions: '', branches: 'ME, EE' })).errors).toContain('No. of Positions is required');
        expect((await one({ positions: 1, branches: 'ME, EE' })).errors).toContain('less than the number of branches');
      });
    });

    it('accepts a unique branch name or short name as well as the code', async () => {
      const res = await service.validate(await fileWith([good({ branches: 'Mechanical Engineering, Elect' })]));
      expect(res.rows[0].branchIds).toEqual(['b-me', 'b-ee']);
    });

    it('rejects bad eligible years', async () => {
      const res = await service.validate(await fileWith([good({ years: '2,5' })]));
      expect(errorsFor(res, 2).join(' ')).toContain('Eligible Years');
    });

    it('enforces deadline not in the past and start strictly after deadline', async () => {
      const res = await service.validate(
        await fileWith([
          good({ deadline: day(-2) }),
          good({ title: 'B', deadline: day(10), start: day(10) }),
          good({ title: 'C', deadline: day(10), start: day(5) }),
        ]),
      );
      expect(errorsFor(res, 2).join(' ')).toContain('cannot be in the past');
      expect(errorsFor(res, 3).join(' ')).toContain('after the Application Deadline');
      expect(errorsFor(res, 4).join(' ')).toContain('after the Application Deadline');
    });

    it('accepts a deadline of today (open until end of day)', async () => {
      const res = await service.validate(await fileWith([good({ deadline: day(0) })]));
      expect(errorsFor(res, 2)).toEqual([]);
    });

    it('rejects duration out of range, bad contact formats, and over-long fields', async () => {
      const res = await service.validate(
        await fileWith([
          good({ duration: 0 }),
          good({ title: 'B', cEmail: 'nope', cPhone: 'abc' }),
          good({ title: 'x'.repeat(121) }),
        ]),
      );
      expect(errorsFor(res, 2).join(' ')).toContain('Duration');
      expect(errorsFor(res, 3).join(' ')).toContain('Contact Email');
      expect(errorsFor(res, 3).join(' ')).toContain('Contact Phone');
      expect(errorsFor(res, 4).join(' ')).toContain('at most 120');
    });

    it('rejects duplicates within the file', async () => {
      const res = await service.validate(await fileWith([good(), good()]));
      expect(res.validRows).toBe(1);
      expect(errorsFor(res, 3).join(' ')).toContain('Duplicate of row 2');
    });

    it('rejects an opportunity that already exists in the database', async () => {
      const r = good();
      const start = (await service.validate(await fileWith([r]))).rows[0].startDate;
      prisma.internshipOpportunity.findMany.mockResolvedValue([
        { companyId: 'c1', title: 'Production Trainee', startDate: start },
      ]);
      const res = await service.validate(await fileWith([r]));
      expect(res.validRows).toBe(0);
      expect(errorsFor(res, 2).join(' ')).toContain('already exists');
    });

    it('skips fully blank rows', async () => {
      const res = await service.validate(await fileWith([good(), {}, good({ title: 'Other' })]));
      expect(res.totalRows).toBe(2);
    });

    it('rejects a file without the Opportunities sheet, with missing columns, or over 500 rows', async () => {
      await expect(
        service.validate(await fileWith([good()], (wb) => { wb.getWorksheet(OPPORTUNITY_SHEET)!.name = 'Sheet1'; })),
      ).rejects.toThrow(/not found/);

      await expect(
        service.validate(await fileWith([good()], (wb) => { wb.getWorksheet(OPPORTUNITY_SHEET)!.getCell('A1').value = 'Firm'; })),
      ).rejects.toThrow(/Missing column/);

      const many = Array.from({ length: 501 }, (_, i) => good({ title: `T${i}` }));
      await expect(service.validate(await fileWith(many))).rejects.toThrow(/Maximum 500/);

      await expect(service.validate(Buffer.from('not an excel file'))).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('confirm', () => {
    const actor = { userId: 'dir1', userName: 'Director', role: 'STATE_DIRECTORATE' };

    function mockTx() {
      const tx = {
        company: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: `new-${data.name}` })),
        },
        internshipOpportunity: { create: jest.fn().mockImplementation(async () => ({ id: `o${Math.random()}` })) },
      };
      prisma.$transaction = jest.fn().mockImplementation(async (fn: any) => fn(tx));
      return tx;
    }

    it('refuses to save anything when rows have errors unless skipInvalid is set', async () => {
      const tx = mockTx();
      await expect(service.confirm(await fileWith([good(), good({ positions: 0, title: 'B' })]), actor, false)).rejects.toThrow(/have errors/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.internshipOpportunity.create).not.toHaveBeenCalled();
    });

    it('saves valid rows, creates a company once, and records branches and the batch id', async () => {
      const tx = mockTx();
      const res = await service.confirm(
        await fileWith([good({ company: 'NewCo' }), good({ company: 'newco', title: 'Second' }), good({ positions: 0, title: 'Bad' })]),
        actor,
        true,
      );
      expect(res).toMatchObject({ imported: 2, skipped: 1 });
      expect(tx.company.create).toHaveBeenCalledTimes(1);
      const first = tx.internshipOpportunity.create.mock.calls[0][0].data;
      expect(first).toMatchObject({ positions: 10, status: 'OPEN', createdById: 'dir1', importBatchId: res.importBatchId });
      // total positions with no per-branch counts are split equally
      expect(first.branches.create).toEqual([
        { branchId: 'b-me', positions: 5, maxApplications: null },
        { branchId: 'b-ee', positions: 5, maxApplications: null },
      ]);
    });

    it('saves branch-wise positions and application limits', async () => {
      const tx = mockTx();
      await service.confirm(await fileWith([good({ positions: '', branches: 'ME:6, EE:4/10' })]), actor, false);
      const data = tx.internshipOpportunity.create.mock.calls[0][0].data;
      expect(data.positions).toBe(10);
      expect(data.branches.create).toEqual([
        { branchId: 'b-me', positions: 6, maxApplications: null },
        { branchId: 'b-ee', positions: 4, maxApplications: 10 },
      ]);
    });

    it('rejects when no valid rows remain', async () => {
      mockTx();
      await expect(service.confirm(await fileWith([good({ positions: 0 })]), actor, true)).rejects.toThrow(/No valid rows/);
    });
  });
});
