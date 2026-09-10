import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateInternshipReportDto } from './dto/create-internship-report.dto';
import { UpdateInternshipReportDto } from './dto/update-internship-report.dto';
import { QueryInternshipReportDto } from './dto/query-internship-report.dto';
import { Role, Prisma } from '../../generated/prisma/client';
import { ExcelUtils } from '../../core/common/utils/excel.util';

const REPORT_SELECT = {
  id: true,
  studentId: true,
  institutionId: true,
  enrollmentStatus: true,
  companyName: true,
  organizationWebsite: true,
  modeOfInternship: true,
  industrySector: true,
  isWorkInPunjab: true,
  workDistrict: true,
  workState: true,
  hrName: true,
  hrPhoneNumber: true,
  isStipendOffered: true,
  stipendAmountPerMonth: true,
  isOfferLetterReceived: true,
  offerLetterUrl: true,
  facultyMentorId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: {
      id: true,
      admissionNumber: true,
      currentSemester: true,
      branch: { select: { name: true } },
      user: { select: { name: true, rollNumber: true, phoneNo: true, email: true } },
    },
  },
  institution: { select: { id: true, name: true, district: true } },
  facultyMentor: { select: { id: true, name: true, phoneNo: true, designationEnum: true, branchName: true } },
} satisfies Prisma.InternshipReportSelect;

@Injectable()
export class InternshipReportService {
  constructor(private readonly prisma: PrismaService) {}

  private async getPrincipalInstitutionId(principalId: string): Promise<string> {
    const principal = await this.prisma.user.findUnique({ where: { id: principalId } });
    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found for this principal');
    }
    return principal.institutionId;
  }

  private async assertStudentInInstitution(studentId: string, institutionId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found in your institution');
    }
  }

  private async assertFacultyMentorInInstitution(facultyMentorId: string, institutionId: string) {
    const mentor = await this.prisma.user.findFirst({
      where: {
        id: facultyMentorId,
        institutionId,
        role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
      },
      select: { id: true },
    });
    if (!mentor) {
      throw new NotFoundException('Faculty mentor not found in your institution');
    }
  }

  async create(principalId: string, dto: CreateInternshipReportDto) {
    const institutionId = await this.getPrincipalInstitutionId(principalId);
    await this.assertStudentInInstitution(dto.studentId, institutionId);
    if (dto.facultyMentorId) {
      await this.assertFacultyMentorInInstitution(dto.facultyMentorId, institutionId);
    }

    return this.prisma.internshipReport.create({
      data: {
        studentId: dto.studentId,
        institutionId,
        enrollmentStatus: dto.enrollmentStatus,
        companyName: dto.companyName,
        organizationWebsite: dto.organizationWebsite,
        modeOfInternship: dto.modeOfInternship,
        industrySector: dto.industrySector,
        isWorkInPunjab: dto.isWorkInPunjab,
        workDistrict: dto.isWorkInPunjab === true ? dto.workDistrict : null,
        workState: dto.isWorkInPunjab === false ? dto.workState : null,
        hrName: dto.hrName,
        hrPhoneNumber: dto.hrPhoneNumber,
        isStipendOffered: dto.isStipendOffered,
        stipendAmountPerMonth: dto.isStipendOffered ? dto.stipendAmountPerMonth : null,
        isOfferLetterReceived: dto.isOfferLetterReceived,
        offerLetterUrl: dto.isOfferLetterReceived ? dto.offerLetterUrl : null,
        facultyMentorId: dto.facultyMentorId,
        createdBy: principalId,
      },
      select: REPORT_SELECT,
    });
  }

  async findAllForPrincipal(principalId: string, query: QueryInternshipReportDto) {
    const institutionId = await this.getPrincipalInstitutionId(principalId);
    return this.findAll({ ...query, institutionId });
  }

  async findAllForState(query: QueryInternshipReportDto) {
    return this.findAll(query);
  }

  private async findAll(query: QueryInternshipReportDto & { institutionId?: string }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.InternshipReportWhereInput = {};

    if (query.institutionId) {
      where.institutionId = query.institutionId;
    }

    if (query.district) {
      where.institution = { district: query.district };
    }

    if (query.search) {
      where.OR = [
        { companyName: { contains: query.search, mode: 'insensitive' } },
        { student: { user: { name: { contains: query.search, mode: 'insensitive' } } } },
        { student: { user: { rollNumber: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.internshipReport.findMany({
        where,
        select: REPORT_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.internshipReport.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private async findOwned(id: string, principalId: string) {
    const institutionId = await this.getPrincipalInstitutionId(principalId);
    const report = await this.prisma.internshipReport.findFirst({
      where: { id, institutionId },
    });
    if (!report) {
      throw new NotFoundException('Internship report not found');
    }
    return report;
  }

  async findOneForPrincipal(id: string, principalId: string) {
    await this.findOwned(id, principalId);
    return this.prisma.internshipReport.findUnique({ where: { id }, select: REPORT_SELECT });
  }

  async findOneForState(id: string) {
    const report = await this.prisma.internshipReport.findUnique({ where: { id }, select: REPORT_SELECT });
    if (!report) {
      throw new NotFoundException('Internship report not found');
    }
    return report;
  }

  async update(id: string, principalId: string, dto: UpdateInternshipReportDto) {
    const existing = await this.findOwned(id, principalId);

    if (dto.facultyMentorId) {
      await this.assertFacultyMentorInInstitution(dto.facultyMentorId, existing.institutionId);
    }

    const isWorkInPunjab = dto.isWorkInPunjab ?? existing.isWorkInPunjab;
    const isStipendOffered = dto.isStipendOffered ?? existing.isStipendOffered;
    const isOfferLetterReceived = dto.isOfferLetterReceived ?? existing.isOfferLetterReceived;

    return this.prisma.internshipReport.update({
      where: { id },
      data: {
        enrollmentStatus: dto.enrollmentStatus,
        companyName: dto.companyName,
        organizationWebsite: dto.organizationWebsite,
        modeOfInternship: dto.modeOfInternship,
        industrySector: dto.industrySector,
        isWorkInPunjab: dto.isWorkInPunjab,
        workDistrict: isWorkInPunjab === true ? (dto.workDistrict ?? existing.workDistrict) : null,
        workState: isWorkInPunjab === false ? (dto.workState ?? existing.workState) : null,
        hrName: dto.hrName,
        hrPhoneNumber: dto.hrPhoneNumber,
        isStipendOffered: dto.isStipendOffered,
        stipendAmountPerMonth: isStipendOffered ? (dto.stipendAmountPerMonth ?? existing.stipendAmountPerMonth) : null,
        isOfferLetterReceived: dto.isOfferLetterReceived,
        offerLetterUrl: isOfferLetterReceived ? (dto.offerLetterUrl ?? existing.offerLetterUrl) : null,
        facultyMentorId: dto.facultyMentorId,
      },
      select: REPORT_SELECT,
    });
  }

  async remove(id: string, principalId: string) {
    await this.findOwned(id, principalId);
    await this.prisma.internshipReport.delete({ where: { id } });
    return { success: true };
  }

  async exportForState(query: QueryInternshipReportDto): Promise<Buffer> {
    const where: Prisma.InternshipReportWhereInput = {};
    if (query.institutionId) where.institutionId = query.institutionId;
    if (query.district) where.institution = { district: query.district };

    const reports = await this.prisma.internshipReport.findMany({
      where,
      select: REPORT_SELECT,
      orderBy: [{ institution: { district: 'asc' } }, { createdAt: 'asc' }],
    });

    // The government template has "Course" as a header twice (student's course, then the
    // faculty mentor's course/branch) — object keys can't repeat, so this is built as
    // header/value arrays rather than array-of-objects.
    const headers = [
      'District',
      'College',
      'Student Name',
      'Registration Number',
      'Student Contact Number',
      'Course',
      'Semester',
      'Is the Student still enrolled or dropped out?',
      'Name of the Organisation of Internship',
      'Mode of Internship\r\n(Online / Offline)',
      'Location of Work \r\nin Punjab (Yes/No)',
      'Location of Work \r\n(District)',
      'In case outside of Punjab (Mention state)',
      'Organization website link',
      'HR Name',
      'HR Phone Number',
      'Sector of the Industry',
      'Stipend Offered (Yes/No)',
      'Amount of Stipend Paid\r\n(Per Month)',
      'Offer Letter Recieved (Yes/No)',
      'Link to the offer letter',
      'Name of Faculty Mentor',
      'Contact Number',
      'Course',
      'Designation',
    ];

    const yesNo = (v: boolean | null | undefined) => (v === true ? 'Yes' : v === false ? 'No' : '');

    const rows = reports.map((r) => [
      r.institution?.district || '',
      r.institution?.name || '',
      r.student?.user?.name || '',
      r.student?.admissionNumber || r.student?.user?.rollNumber || '',
      r.student?.user?.phoneNo || '',
      r.student?.branch?.name || '',
      r.student?.currentSemester ?? '',
      r.enrollmentStatus === 'DROPPED_OUT' ? 'Dropped Out' : 'Enrolled',
      r.companyName,
      r.modeOfInternship || '',
      yesNo(r.isWorkInPunjab),
      r.workDistrict || '',
      r.workState || '',
      r.organizationWebsite || '',
      r.hrName || '',
      r.hrPhoneNumber || '',
      r.industrySector || '',
      yesNo(r.isStipendOffered),
      r.stipendAmountPerMonth ?? '',
      yesNo(r.isOfferLetterReceived),
      r.offerLetterUrl || '',
      r.facultyMentor?.name || '',
      r.facultyMentor?.phoneNo || '',
      r.facultyMentor?.branchName || '',
      r.facultyMentor?.designationEnum || '',
    ]);

    return ExcelUtils.buildWorkbook((workbook) => {
      const worksheet = workbook.addWorksheet('TPO Internship Report');
      worksheet.addRow(headers);
      worksheet.getRow(1).font = { bold: true };
      rows.forEach((row) => worksheet.addRow(row));
      headers.forEach((header, index) => {
        worksheet.getColumn(index + 1).width = Math.min(Math.max(header.replace(/\r?\n/g, ' ').length + 2, 12), 40);
      });
    });
  }
}
