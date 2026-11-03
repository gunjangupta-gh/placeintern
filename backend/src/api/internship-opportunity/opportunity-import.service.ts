import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../core/database/prisma.service';
import { readExcelBuffer } from '../../core/common/utils/excel.util';
import { AuditService } from '../../infrastructure/audit/audit.service';
import {
  AuditAction,
  AuditCategory,
  AuditSeverity,
  OpportunityStatus,
} from '../../generated/prisma/client';
import {
  MAX_DURATION_MONTHS,
  MAX_IMPORT_ROWS,
  MAX_POSITIONS_PER_ROW,
  VALID_ELIGIBLE_YEARS,
} from './opportunity.constants';
import {
  endOfDayIST,
  parseCalendarDate,
  startOfDayIST,
  todayStartIST,
} from './opportunity-dates.util';

export const OPPORTUNITY_SHEET = 'Opportunities';

/** Header text (as shown in the template) -> internal key. Matching ignores case and the `*`. */
const COLUMNS: ReadonlyArray<{ header: string; key: string; width: number }> = [
  { header: 'Company Name*', key: 'company', width: 30 },
  { header: 'District*', key: 'district', width: 18 },
  { header: 'Position Title*', key: 'title', width: 28 },
  { header: 'No. of Positions*', key: 'positions', width: 16 },
  { header: 'Eligible Branches*', key: 'branches', width: 30 },
  { header: 'Eligible Years', key: 'years', width: 14 },
  { header: 'Duration (Months)*', key: 'duration', width: 18 },
  { header: 'Stipend', key: 'stipend', width: 14 },
  { header: 'Start Date*', key: 'startDate', width: 16 },
  { header: 'Application Deadline*', key: 'deadline', width: 22 },
  { header: 'Description', key: 'description', width: 40 },
  { header: 'Contact Name', key: 'contactName', width: 20 },
  { header: 'Contact Phone', key: 'contactPhone', width: 16 },
  { header: 'Contact Email', key: 'contactEmail', width: 26 },
];

const normHeader = (s: string) => s.replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const HEADER_TO_KEY = new Map(COLUMNS.map((c) => [normHeader(c.header), c.key]));

export interface ParsedOpportunityRow {
  row: number;
  company: string;
  district: string;
  title: string;
  positions: number;
  branchCodes: string[];
  branchIds: string[];
  eligibleYears: number[];
  durationMonths: number;
  stipend: string | null;
  startDate: Date;
  applicationDeadline: Date;
  description: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
}

export interface RowError {
  row: number;
  messages: string[];
}

export interface ImportValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: RowError[];
  rows: ParsedOpportunityRow[]; // valid rows only
  newCompanies: string[];
}

interface BranchRef {
  id: string;
  code: string;
  name: string;
  shortName: string;
}

@Injectable()
export class OpportunityImportService {
  private readonly logger = new Logger(OpportunityImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Template
  // ---------------------------------------------------------------------------

  async getTemplate(): Promise<Buffer> {
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      select: { code: true, name: true, shortName: true },
      orderBy: { name: 'asc' },
    });

    const wb = new ExcelJS.Workbook();

    // --- Opportunities sheet (header on row 1, data from row 2) ---
    const ws = wb.addWorksheet(OPPORTUNITY_SHEET, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    header.alignment = { vertical: 'middle', wrapText: true };
    header.height = 30;

    const colIndex = (key: string) => COLUMNS.findIndex((c) => c.key === key) + 1;
    const positionsCol = colIndex('positions');
    const durationCol = colIndex('duration');
    const startCol = colIndex('startDate');
    const deadlineCol = colIndex('deadline');
    const minDate = new Date(Date.UTC(2020, 0, 1));

    for (let r = 2; r <= MAX_IMPORT_ROWS + 1; r++) {
      ws.getCell(r, positionsCol).dataValidation = {
        type: 'whole',
        operator: 'between',
        formulae: [1, MAX_POSITIONS_PER_ROW],
        showErrorMessage: true,
        errorTitle: 'Invalid positions',
        error: `Enter a whole number from 1 to ${MAX_POSITIONS_PER_ROW}`,
      };
      ws.getCell(r, durationCol).dataValidation = {
        type: 'whole',
        operator: 'between',
        formulae: [1, MAX_DURATION_MONTHS],
        showErrorMessage: true,
        errorTitle: 'Invalid duration',
        error: `Enter a whole number of months from 1 to ${MAX_DURATION_MONTHS}`,
      };
      for (const col of [startCol, deadlineCol]) {
        const cell = ws.getCell(r, col);
        cell.numFmt = 'dd-mmm-yyyy';
        cell.dataValidation = {
          type: 'date',
          operator: 'greaterThan',
          formulae: [minDate],
          showErrorMessage: true,
          errorTitle: 'Invalid date',
          error: 'Enter a valid date, e.g. 15-Jan-2027',
        };
      }
    }

    header.getCell(colIndex('branches')).note =
      'Branch CODES from the "Branches" sheet, separated by commas. Example: ME, EE, ECE';
    header.getCell(colIndex('years')).note =
      'Optional. Years allowed to apply, e.g. 2, 3. Leave blank for all years.';

    // --- Branches reference sheet ---
    const bs = wb.addWorksheet('Branches');
    bs.columns = [
      { header: 'Code (use this)', key: 'code', width: 18 },
      { header: 'Branch Name', key: 'name', width: 40 },
      { header: 'Short Name', key: 'shortName', width: 16 },
    ];
    bs.getRow(1).font = { bold: true };
    branches.forEach((b) => bs.addRow({ code: b.code, name: b.name, shortName: b.shortName }));

    // --- Instructions sheet ---
    const is = wb.addWorksheet('Instructions');
    is.columns = [
      { header: 'Field', key: 'field', width: 26 },
      { header: 'Required', key: 'required', width: 10 },
      { header: 'Rule', key: 'rule', width: 90 },
    ];
    is.getRow(1).font = { bold: true };
    [
      ['One row = one position', '', 'Create one row per internship position/role. Do not merge cells or add blank header rows.'],
      ['Company Name', 'Yes', 'Matched to an existing company (case-insensitive); created if new.'],
      ['District', 'Yes', 'Where the internship is located.'],
      ['Position Title', 'Yes', 'e.g. Production Trainee. Max 120 characters.'],
      ['No. of Positions', 'Yes', `Whole number, 1 to ${MAX_POSITIONS_PER_ROW}. Applications are capped at this number.`],
      ['Eligible Branches', 'Yes', 'Branch codes from the Branches sheet, comma separated. Unknown codes are rejected.'],
      ['Eligible Years', 'No', 'Subset of 1, 2, 3 comma separated. Blank = all years.'],
      ['Duration (Months)', 'Yes', `Whole number, 1 to ${MAX_DURATION_MONTHS}.`],
      ['Stipend', 'No', 'Free text, e.g. 8000 per month. Max 50 characters.'],
      ['Start Date', 'Yes', 'Must be after the Application Deadline.'],
      ['Application Deadline', 'Yes', 'Today or later. Students can apply up to the end of this day.'],
      ['Description', 'No', 'Max 2000 characters.'],
      ['Contact Name/Phone/Email', 'No', 'Industry contact. Visible to State Directorate only - never shown to students.'],
      ['Limits', '', `Maximum ${MAX_IMPORT_ROWS} rows per upload. The upload is previewed first; nothing is saved until you confirm.`],
    ].forEach(([field, required, rule]) => is.addRow({ field, required, rule }));

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ---------------------------------------------------------------------------
  // Parse + validate
  // ---------------------------------------------------------------------------

  private cellText(value: ExcelJS.CellValue): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return '';
    if (typeof value === 'object') {
      const v = value as any;
      if (v.richText) return v.richText.map((t: any) => t.text).join('').trim();
      if (v.text !== undefined) return String(v.text).trim(); // hyperlink
      if (v.result !== undefined) return String(v.result).trim(); // formula
      return '';
    }
    return String(value).trim();
  }

  private cellRaw(value: ExcelJS.CellValue): unknown {
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      const v = value as any;
      if (v.result !== undefined) return v.result;
      if (v.richText) return this.cellText(value);
    }
    return value;
  }

  private async readRows(buffer: Buffer): Promise<Array<{ row: number; raw: Record<string, unknown> }>> {
    let workbook: ExcelJS.Workbook;
    try {
      workbook = await readExcelBuffer(buffer);
    } catch {
      throw new BadRequestException('Could not read the file. Please upload the .xlsx template.');
    }
    const sheet = workbook.getWorksheet(OPPORTUNITY_SHEET);
    if (!sheet) {
      throw new BadRequestException(
        `Sheet "${OPPORTUNITY_SHEET}" not found. Please use the downloaded template.`,
      );
    }

    const colKeys = new Map<number, string>();
    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
      const key = HEADER_TO_KEY.get(normHeader(this.cellText(cell.value)));
      if (key) colKeys.set(col, key);
    });
    const required = ['company', 'title', 'positions', 'branches', 'startDate', 'deadline', 'duration', 'district'];
    const present = new Set(colKeys.values());
    const missingCols = required.filter((k) => !present.has(k));
    if (missingCols.length) {
      const names = missingCols.map((k) => COLUMNS.find((c) => c.key === k)!.header);
      throw new BadRequestException(`Missing column(s): ${names.join(', ')}. Please use the downloaded template.`);
    }

    const out: Array<{ row: number; raw: Record<string, unknown> }> = [];
    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const raw: Record<string, unknown> = {};
      let any = false;
      colKeys.forEach((key, col) => {
        const value = this.cellRaw(row.getCell(col).value);
        raw[key] = value;
        if (this.cellText(value as ExcelJS.CellValue) !== '' || value instanceof Date) any = true;
      });
      if (any) out.push({ row: r, raw });
    }
    if (out.length === 0) throw new BadRequestException('No data rows found in the file');
    if (out.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(`Maximum ${MAX_IMPORT_ROWS} rows can be uploaded at once`);
    }
    return out;
  }

  private resolveBranches(
    tokens: string[],
    refs: { byCode: Map<string, BranchRef>; byName: Map<string, BranchRef[]>; byShort: Map<string, BranchRef[]> },
  ): { ok: BranchRef[]; unknown: string[]; ambiguous: string[] } {
    const ok: BranchRef[] = [];
    const unknown: string[] = [];
    const ambiguous: string[] = [];
    for (const token of tokens) {
      const t = token.toLowerCase();
      const byCode = refs.byCode.get(t);
      if (byCode) {
        ok.push(byCode);
        continue;
      }
      const byName = refs.byName.get(t) ?? [];
      const byShort = refs.byShort.get(t) ?? [];
      const candidates = byName.length ? byName : byShort;
      if (candidates.length === 1) ok.push(candidates[0]);
      else if (candidates.length > 1) ambiguous.push(token);
      else unknown.push(token);
    }
    return { ok, unknown, ambiguous };
  }

  async validate(buffer: Buffer): Promise<ImportValidationResult> {
    const rawRows = await this.readRows(buffer);

    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, shortName: true },
    });
    const refs = {
      byCode: new Map<string, BranchRef>(),
      byName: new Map<string, BranchRef[]>(),
      byShort: new Map<string, BranchRef[]>(),
    };
    for (const b of branches) {
      refs.byCode.set(b.code.toLowerCase(), b);
      const n = b.name.toLowerCase();
      const s = b.shortName.toLowerCase();
      refs.byName.set(n, [...(refs.byName.get(n) ?? []), b]);
      refs.byShort.set(s, [...(refs.byShort.get(s) ?? []), b]);
    }

    const existingCompanies = await this.prisma.company.findMany({ select: { id: true, name: true } });
    const companyByLower = new Map(existingCompanies.map((c) => [c.name.toLowerCase(), c.id]));

    const today = todayStartIST();
    const errors: RowError[] = [];
    const rows: ParsedOpportunityRow[] = [];
    const seenInFile = new Map<string, number>();
    const newCompanies = new Set<string>();

    for (const { row, raw } of rawRows) {
      const msgs: string[] = [];
      const text = (k: string) => this.cellText(raw[k] as ExcelJS.CellValue);

      const company = text('company').replace(/\s+/g, ' ');
      if (!company) msgs.push('Company Name is required');
      else if (company.length > 150) msgs.push('Company Name must be at most 150 characters');

      const district = text('district');
      if (!district) msgs.push('District is required');
      else if (district.length > 80) msgs.push('District must be at most 80 characters');

      const title = text('title').replace(/\s+/g, ' ');
      if (!title) msgs.push('Position Title is required');
      else if (title.length > 120) msgs.push('Position Title must be at most 120 characters');

      // Positions: integer 1..MAX (numeric cell or numeric string; reject 10.5, "ten", 0, negatives)
      let positions = NaN;
      const posText = text('positions');
      if (!posText) msgs.push('No. of Positions is required');
      else if (!/^\d+$/.test(posText.replace(/\.0+$/, ''))) {
        msgs.push('No. of Positions must be a whole number');
      } else {
        positions = Number(posText.replace(/\.0+$/, ''));
        if (positions < 1 || positions > MAX_POSITIONS_PER_ROW) {
          msgs.push(`No. of Positions must be between 1 and ${MAX_POSITIONS_PER_ROW}`);
          positions = NaN;
        }
      }

      // Duration
      let duration = NaN;
      const durText = text('duration');
      if (!durText) msgs.push('Duration (Months) is required');
      else if (!/^\d+$/.test(durText.replace(/\.0+$/, ''))) {
        msgs.push('Duration (Months) must be a whole number');
      } else {
        duration = Number(durText.replace(/\.0+$/, ''));
        if (duration < 1 || duration > MAX_DURATION_MONTHS) {
          msgs.push(`Duration (Months) must be between 1 and ${MAX_DURATION_MONTHS}`);
          duration = NaN;
        }
      }

      // Branches (exact match to the Branch table)
      const branchTokens = Array.from(
        new Set(
          text('branches')
            .split(/[,;\n]/)
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      );
      let branchRefs: BranchRef[] = [];
      if (branchTokens.length === 0) {
        msgs.push('Eligible Branches is required');
      } else {
        const res = this.resolveBranches(branchTokens, refs);
        if (res.unknown.length) msgs.push(`Unknown branch(es): ${res.unknown.join(', ')}. Use codes from the Branches sheet`);
        if (res.ambiguous.length) msgs.push(`Ambiguous branch name(s): ${res.ambiguous.join(', ')}. Use the branch code`);
        branchRefs = Array.from(new Map(res.ok.map((b) => [b.id, b])).values());
      }

      // Eligible years (optional)
      let years: number[] = [];
      const yearsText = text('years');
      if (yearsText && yearsText.toLowerCase() !== 'all') {
        const parts = yearsText.split(/[,;\s]+/).filter(Boolean);
        const nums = parts.map((p) => Number(p));
        if (nums.some((n) => !Number.isInteger(n) || !VALID_ELIGIBLE_YEARS.includes(n))) {
          msgs.push(`Eligible Years must be from ${VALID_ELIGIBLE_YEARS.join(', ')} (comma separated) or blank`);
        } else {
          years = Array.from(new Set(nums)).sort();
        }
      }

      const stipendRaw = raw.stipend;
      const stipend = this.cellText(stipendRaw as ExcelJS.CellValue) || null;
      if (stipend && stipend.length > 50) msgs.push('Stipend must be at most 50 characters');

      const description = text('description') || null;
      if (description && description.length > 2000) msgs.push('Description must be at most 2000 characters');

      // Dates
      const startCal = parseCalendarDate(raw.startDate instanceof Date ? raw.startDate : text('startDate'));
      const deadlineCal = parseCalendarDate(raw.deadline instanceof Date ? raw.deadline : text('deadline'));
      let startDate: Date | null = null;
      let deadline: Date | null = null;
      if (!startCal) msgs.push('Start Date is required and must be a valid date (e.g. 15-Jan-2027)');
      else startDate = startOfDayIST(startCal);
      if (!deadlineCal) msgs.push('Application Deadline is required and must be a valid date (e.g. 15-Dec-2026)');
      else deadline = endOfDayIST(deadlineCal);
      if (deadline && startOfDayIST(deadlineCal!) < today) msgs.push('Application Deadline cannot be in the past');
      if (startDate && deadline && startDate.getTime() <= deadline.getTime()) {
        msgs.push('Start Date must be after the Application Deadline');
      }

      // Contact (director-only)
      const contactName = text('contactName') || null;
      const contactPhone = text('contactPhone') || null;
      const contactEmail = text('contactEmail') || null;
      if (contactName && contactName.length > 100) msgs.push('Contact Name must be at most 100 characters');
      if (contactPhone && !/^[0-9+\-\s()]{7,20}$/.test(contactPhone)) msgs.push('Contact Phone is not a valid phone number');
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) msgs.push('Contact Email is not a valid email');

      // Duplicates: within file, then against saved opportunities
      if (company && title && startDate) {
        const key = `${company.toLowerCase()}|${title.toLowerCase()}|${startDate.toISOString()}`;
        const first = seenInFile.get(key);
        if (first !== undefined) msgs.push(`Duplicate of row ${first} (same company, position and start date)`);
        else seenInFile.set(key, row);
      }

      if (msgs.length) {
        errors.push({ row, messages: msgs });
        continue;
      }

      if (!companyByLower.has(company.toLowerCase())) newCompanies.add(company);

      rows.push({
        row,
        company,
        district,
        title,
        positions,
        branchCodes: branchRefs.map((b) => b.code),
        branchIds: branchRefs.map((b) => b.id),
        eligibleYears: years,
        durationMonths: duration,
        stipend,
        startDate: startDate!,
        applicationDeadline: deadline!,
        description,
        contactName,
        contactPhone,
        contactEmail,
      });
    }

    // Duplicates against already-saved opportunities (single batched query)
    const knownCompanyIds = rows
      .map((r) => companyByLower.get(r.company.toLowerCase()))
      .filter((id): id is string => !!id);
    if (knownCompanyIds.length) {
      const existing = await this.prisma.internshipOpportunity.findMany({
        where: { isDeleted: false, companyId: { in: Array.from(new Set(knownCompanyIds)) } },
        select: { companyId: true, title: true, startDate: true },
      });
      const existingKeys = new Set(
        existing.map((e) => `${e.companyId}|${e.title.toLowerCase()}|${e.startDate.toISOString()}`),
      );
      for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        const cid = companyByLower.get(r.company.toLowerCase());
        if (cid && existingKeys.has(`${cid}|${r.title.toLowerCase()}|${r.startDate.toISOString()}`)) {
          errors.push({ row: r.row, messages: ['This opportunity already exists (same company, position and start date)'] });
          rows.splice(i, 1);
        }
      }
    }

    errors.sort((a, b) => a.row - b.row);
    return {
      totalRows: rawRows.length,
      validRows: rows.length,
      invalidRows: errors.length,
      errors,
      rows,
      newCompanies: Array.from(newCompanies),
    };
  }

  // ---------------------------------------------------------------------------
  // Confirm (re-validates server-side; never trusts the earlier preview)
  // ---------------------------------------------------------------------------

  async confirm(
    buffer: Buffer,
    actor: { userId: string; userName?: string; role: any },
    skipInvalid: boolean,
  ) {
    const result = await this.validate(buffer);

    if (result.invalidRows > 0 && !skipInvalid) {
      throw new BadRequestException({
        message: `${result.invalidRows} row(s) have errors. Fix them, or confirm with "skip invalid rows".`,
        errors: result.errors,
      });
    }
    if (result.rows.length === 0) {
      throw new BadRequestException({ message: 'No valid rows to import', errors: result.errors });
    }

    const importBatchId = randomUUID();
    const created = await this.prisma.$transaction(
      async (tx) => {
        const companyIds = new Map<string, string>();
        const ids: string[] = [];
        for (const r of result.rows) {
          const lower = r.company.toLowerCase();
          let companyId = companyIds.get(lower);
          if (!companyId) {
            const found = await tx.company.findFirst({
              where: { name: { equals: r.company, mode: 'insensitive' } },
              select: { id: true },
            });
            companyId = found
              ? found.id
              : (await tx.company.create({ data: { name: r.company }, select: { id: true } })).id;
            companyIds.set(lower, companyId);
          }
          const opp = await tx.internshipOpportunity.create({
            data: {
              companyId,
              title: r.title,
              description: r.description,
              district: r.district,
              positions: r.positions,
              eligibleYears: r.eligibleYears,
              durationMonths: r.durationMonths,
              stipend: r.stipend,
              startDate: r.startDate,
              applicationDeadline: r.applicationDeadline,
              status: OpportunityStatus.OPEN,
              contactName: r.contactName,
              contactPhone: r.contactPhone,
              contactEmail: r.contactEmail,
              importBatchId,
              createdById: actor.userId,
              branches: { create: r.branchIds.map((branchId) => ({ branchId })) },
            },
            select: { id: true },
          });
          ids.push(opp.id);
        }
        return ids;
      },
      { timeout: 60000 },
    );

    this.audit
      .log({
        action: AuditAction.DATA_IMPORT,
        entityType: 'InternshipOpportunity',
        entityId: importBatchId,
        userId: actor.userId,
        userName: actor.userName,
        userRole: actor.role,
        description: `Imported ${created.length} internship opportunities (${result.invalidRows} rows skipped)`,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.MEDIUM,
        newValues: { importBatchId, imported: created.length, skipped: result.invalidRows },
      })
      .catch((e) => this.logger.warn(`Audit failed: ${e?.message}`));

    return {
      importBatchId,
      imported: created.length,
      skipped: result.invalidRows,
      errors: result.errors,
    };
  }
}
