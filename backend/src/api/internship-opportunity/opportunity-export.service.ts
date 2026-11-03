import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, Prisma } from '../../generated/prisma/client';
import { buildApplicationWhere } from './application-filters';
import { APPLICATION_STATUS_GROUPS, SEAT_HOLDING_STATUSES } from './opportunity.constants';
import { ExportApplicationsQueryDto } from './dto/opportunity.dto';
import { Actor } from './opportunity.service';

const MAX_EXPORT_ROWS = 20000;

/** Neutralise spreadsheet formula injection: text starting with = + - @ (or tab/CR) is prefixed. */
const safe = (v: unknown): string | number => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  const s = String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

/** Calendar date in IST as text, so Excel cannot shift it by a day. */
const day = (d?: Date | null) =>
  d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';

/** Date + time in India, to the second: the exact moment the student applied. */
const stamp = (d?: Date | null) =>
  d
    ? d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
      })
    : '';

const SELECTED = new Set<string>(APPLICATION_STATUS_GROUPS.SELECTED);

@Injectable()
export class OpportunityExportService {
  private readonly logger = new Logger(OpportunityExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private style(ws: ExcelJS.Worksheet) {
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    header.alignment = { vertical: 'middle', wrapText: true };
    header.height = 26;
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  }

  /**
   * One workbook: Applications (all rows matching the filters), Selected Students (confirmed
   * ones only) and an Opportunities summary with seat counts.
   */
  async buildWorkbook(q: ExportApplicationsQueryDto, actor: Actor): Promise<Buffer> {
    const where = buildApplicationWhere(q);

    const apps = await this.prisma.internshipApplication.findMany({
      where,
      take: MAX_EXPORT_ROWS,
      orderBy: [{ opportunity: { company: { name: 'asc' } } }, { opportunityId: 'asc' }, { appliedDate: 'asc' }, { id: 'asc' }],
      select: {
        status: true,
        internshipPhase: true,
        appliedDate: true,
        reviewedAt: true,
        reviewRemarks: true,
        rejectionReason: true,
        startDate: true,
        endDate: true,
        joiningLetterUrl: true,
        mentor: { select: { name: true } },
        _count: { select: { monthlyReports: true, facultyVisitLogs: true } },
        opportunity: {
          select: { title: true, district: true, durationMonths: true, stipend: true, company: { select: { name: true } } },
        },
        student: {
          select: {
            currentYear: true,
            user: { select: { name: true, rollNumber: true, email: true, phoneNo: true } },
            Institution: { select: { name: true } },
            branch: { select: { name: true, code: true } },
          },
        },
      },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Internship Portal';
    wb.created = new Date();

    const appColumns = [
      { header: 'S.No', key: 'sno', width: 7 },
      { header: 'Company', key: 'company', width: 28 },
      { header: 'Position', key: 'title', width: 26 },
      { header: 'District', key: 'district', width: 16 },
      { header: 'Student Name', key: 'name', width: 24 },
      { header: 'Roll No', key: 'roll', width: 16 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Applied At (IST)', key: 'applied', width: 24 },
      { header: 'Institution', key: 'institution', width: 32 },
      { header: 'Branch', key: 'branch', width: 24 },
      { header: 'Year', key: 'year', width: 7 },
      { header: 'Status', key: 'status', width: 13 },
      { header: 'Decision On', key: 'decided', width: 14 },
      { header: 'Remarks / Reason', key: 'remarks', width: 34 },
      { header: 'Start Date', key: 'start', width: 14 },
      { header: 'End Date', key: 'end', width: 14 },
      { header: 'Internship Phase', key: 'phase', width: 16 },
      { header: 'Mentor', key: 'mentor', width: 22 },
      { header: 'Joining Letter', key: 'letter', width: 14 },
      { header: 'Reports Submitted', key: 'reports', width: 12 },
      { header: 'Visits Done', key: 'visits', width: 10 },
    ];

    const toRow = (a: (typeof apps)[number], i: number) => ({
      sno: i + 1,
      company: safe(a.opportunity?.company?.name),
      title: safe(a.opportunity?.title),
      district: safe(a.opportunity?.district),
      name: safe(a.student?.user?.name),
      roll: safe(a.student?.user?.rollNumber),
      email: safe(a.student?.user?.email),
      phone: safe(a.student?.user?.phoneNo),
      institution: safe(a.student?.Institution?.name),
      branch: safe(a.student?.branch?.name),
      year: a.student?.currentYear ?? '',
      applied: stamp(a.appliedDate),
      status: a.status,
      decided: day(a.reviewedAt),
      remarks: safe(a.rejectionReason || a.reviewRemarks),
      start: day(a.startDate),
      end: day(a.endDate),
      phase: SELECTED.has(a.status) ? a.internshipPhase : '',
      mentor: safe(a.mentor?.name),
      letter: SELECTED.has(a.status) ? (a.joiningLetterUrl ? 'Uploaded' : 'Pending') : '',
      reports: a._count.monthlyReports,
      visits: a._count.facultyVisitLogs,
    });

    const all = wb.addWorksheet('Applications');
    all.columns = appColumns;
    apps.forEach((a, i) => all.addRow(toRow(a, i)));
    this.style(all);

    const selectedSheet = wb.addWorksheet('Selected Students');
    selectedSheet.columns = appColumns;
    apps.filter((a) => SELECTED.has(a.status)).forEach((a, i) => selectedSheet.addRow(toRow(a, i)));
    this.style(selectedSheet);

    // Opportunities summary (one opportunity if filtered to one, otherwise all)
    const oppWhere: Prisma.InternshipOpportunityWhereInput = { isDeleted: false, ...(q.opportunityId ? { id: q.opportunityId } : {}) };
    const opps = await this.prisma.internshipOpportunity.findMany({
      where: oppWhere,
      orderBy: [{ company: { name: 'asc' } }, { title: 'asc' }],
      select: {
        id: true, title: true, district: true, positions: true, approvedCount: true, status: true, durationMonths: true,
        stipend: true, startDate: true, applicationDeadline: true, contactName: true, contactPhone: true, contactEmail: true,
        company: { select: { name: true } },
        branches: {
          select: { positions: true, approvedCount: true, maxApplications: true, branch: { select: { code: true } } },
        },
      },
    });
    const grouped = opps.length
      ? await this.prisma.internshipApplication.groupBy({
          by: ['opportunityId'],
          where: { opportunityId: { in: opps.map((o) => o.id) }, isActive: true, status: { in: SEAT_HOLDING_STATUSES } },
          _count: { _all: true },
        })
      : [];
    const holding = new Map(grouped.map((g) => [g.opportunityId as string, g._count._all]));

    const os = wb.addWorksheet('Opportunities');
    os.columns = [
      { header: 'S.No', key: 'sno', width: 7 },
      { header: 'Company', key: 'company', width: 28 },
      { header: 'Position', key: 'title', width: 26 },
      { header: 'District', key: 'district', width: 16 },
      { header: 'Branch-wise Positions (selected/positions, max applications)', key: 'branches', width: 46 },
      { header: 'Positions', key: 'positions', width: 10 },
      { header: 'Applications (active)', key: 'applied', width: 12 },
      { header: 'Selected', key: 'selected', width: 10 },
      { header: 'Seats Left', key: 'left', width: 10 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Duration (months)', key: 'duration', width: 11 },
      { header: 'Stipend', key: 'stipend', width: 14 },
      { header: 'Start Date', key: 'start', width: 14 },
      { header: 'Application Deadline', key: 'deadline', width: 16 },
      { header: 'Contact Name', key: 'cname', width: 20 },
      { header: 'Contact Phone', key: 'cphone', width: 15 },
      { header: 'Contact Email', key: 'cemail', width: 26 },
    ];
    opps.forEach((o, i) => {
      const applied = holding.get(o.id) ?? 0;
      os.addRow({
        sno: i + 1,
        company: safe(o.company.name),
        title: safe(o.title),
        district: safe(o.district),
        branches: o.branches
          .map((b) => `${b.branch.code}: ${b.approvedCount}/${b.positions} (max ${b.maxApplications ?? b.positions})`)
          .join('; '),
        positions: o.positions,
        applied,
        selected: o.approvedCount,
        left: o.branches.reduce((n, b) => n + Math.max(b.positions - b.approvedCount, 0), 0),
        status: o.status,
        duration: o.durationMonths,
        stipend: safe(o.stipend),
        start: day(o.startDate),
        deadline: day(o.applicationDeadline),
        cname: safe(o.contactName),
        cphone: safe(o.contactPhone),
        cemail: safe(o.contactEmail),
      });
    });
    this.style(os);

    this.audit
      .log({
        action: AuditAction.DATA_EXPORT,
        entityType: 'InternshipApplication',
        entityId: q.opportunityId ?? 'all',
        userId: actor.userId,
        userName: actor.userName,
        userRole: actor.role,
        description: `Exported ${apps.length} internship application(s) to Excel`,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.MEDIUM,
        newValues: { rows: apps.length, filters: { ...q, search: q.search ? '(set)' : undefined } },
      })
      .catch((e) => this.logger.warn(`Audit failed: ${e?.message}`));

    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
