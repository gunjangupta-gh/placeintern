import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  Prisma,
  InstitutionType,
  DeactivationReason,
  SemesterResultStatus,
  Designation,
  Role,
  CoveredAreaEntityType,
} from '../../../generated/prisma/client';

/**
 * Read-only data builders for the two State downloads:
 *  - CM Dashboard (state-wide, two college groups)
 *  - Complete Information (Courses) for one college
 *
 * `year` is the report year (e.g. 2026): enrolment is for year-(year+1), and
 * result / dropout / placement are for the batch passing out in `year`
 * (admitted year-3). Nothing is stored; every figure is counted on demand.
 */

// "Govt Promoted" has no InstitutionType yet - add it to GROUP_B when it exists.
const GROUP_A_TYPES: InstitutionType[] = [
  InstitutionType.GOVT_POLYTECHNIC,
  InstitutionType.GOVT_SPECIAL_TRADE_INSTITUTE,
];
const GROUP_B_TYPES: InstitutionType[] = [
  InstitutionType.GOVT_AIDED_POLYTECHNIC,
  InstitutionType.PRIVATE_POLYTECHNIC,
  InstitutionType.GOVT_AIDED_SPECIAL_TRADE_INSTITUTE,
  InstitutionType.PRIVATE_SPECIAL_TRADE_INSTITUTE,
];

const TEACHING_DESIGNATIONS: Designation[] = [
  Designation.HOD,
  Designation.SENIOR_LECTURER,
  Designation.LECTURER,
  Designation.ASSISTANT_PROFESSOR,
];
const WORKSHOP_SUPERINTENDENT: Designation[] = [Designation.WORKSHOP_SUPERINTENDENT];
const WORKSHOP_FOREMAN: Designation[] = [Designation.FOREMAN_INSTRUCTOR, Designation.WORKSHOP_FOREMAN];
const WORKSHOP_INSTRUCTOR: Designation[] = [Designation.WORKSHOP_INSTRUCTOR, Designation.INSTRUCTOR];

export const academicYearLabel = (year: number) => `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
const batchLabel = (startYear: number) => `${startYear}-${String((startYear + 3) % 100).padStart(2, '0')}`;

const FEMALE_GENDERS = ['female', 'f', 'girl'];

export interface CmCell {
  total: number;
  girls: number;
  sc: number;
}
export interface CmDropoutCell {
  enrolled: number;
  appeared: number;
  dropout: number;
}
export interface CmResultCell {
  appeared: number;
  passed: number;
}
export interface CmGroupData {
  label: string;
  institutionCount: number;
  sanctionedSeats: number;
  enrolment: CmCell;
  result: { total: CmResultCell; girls: CmResultCell; sc: CmResultCell };
  dropout: { total: CmDropoutCell; girls: CmDropoutCell; sc: CmDropoutCell };
  placement: CmCell;
}
export interface CmDashboardData {
  year: number;
  enrolmentYearLabel: string;
  batchLabel: string;
  groups: { govt: CmGroupData; other: CmGroupData };
  vacancy: {
    teaching: { sanctioned: number; filled: number; vacant: number };
    nonTeaching: { sanctioned: number | null; filled: number | null; vacant: number | null };
  };
  generatedAt: string;
}

@Injectable()
export class StateCmReportService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- shared filters ----------

  private cohortWhere(startYear: number): Prisma.StudentWhereInput {
    return {
      OR: [
        { batch: { name: { startsWith: `${startYear}-` } } },
        { batchId: null, admissionYear: startYear },
      ],
    };
  }

  private girlsWhere(): Prisma.StudentWhereInput {
    return { OR: FEMALE_GENDERS.map((g) => ({ gender: { equals: g, mode: 'insensitive' as const } })) };
  }

  private slices(): Array<[keyof CmCell, Prisma.StudentWhereInput]> {
    return [
      ['total', {}],
      ['girls', this.girlsWhere()],
      ['sc', { category: 'SC' }],
    ];
  }

  // ---------- CM Dashboard ----------

  async getCmDashboard(year: number): Promise<CmDashboardData> {
    const start = year - 3;
    const [govt, other, teaching] = await Promise.all([
      this.buildGroup('Government Polytechnic Colleges and Special Trade Institutes', GROUP_A_TYPES, year, start),
      this.buildGroup('Govt Promoted, Private and Aided Polytechnic Colleges', GROUP_B_TYPES, year, start),
      this.teachingVacancy(GROUP_A_TYPES, year),
    ]);

    return {
      year,
      enrolmentYearLabel: academicYearLabel(year),
      batchLabel: batchLabel(start),
      groups: { govt, other },
      vacancy: {
        teaching,
        // No sanctioned-post data is stored for non-teaching staff yet.
        nonTeaching: { sanctioned: null, filled: null, vacant: null },
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private async buildGroup(label: string, types: InstitutionType[], year: number, start: number): Promise<CmGroupData> {
    const instWhere: Prisma.StudentWhereInput = { Institution: { type: { in: types } } };

    const [institutionCount, seats] = await Promise.all([
      this.prisma.institution.count({ where: { type: { in: types } } }),
      this.prisma.branchIntake.aggregate({
        _sum: { sanctionedSeats: true },
        where: { academicYear: academicYearLabel(year), isActive: true, institution: { type: { in: types } } },
      }),
    ]);

    const count = (...parts: Prisma.StudentWhereInput[]) =>
      this.prisma.student.count({ where: { AND: [instWhere, ...parts] } });

    const appearedWhere: Prisma.StudentWhereInput = {
      semesterStatuses: {
        some: { semester: 6, status: { in: [SemesterResultStatus.APPEARED, SemesterResultStatus.PASSED] } },
      },
    };
    const passedWhere: Prisma.StudentWhereInput = {
      semesterStatuses: { some: { semester: 6, status: SemesterResultStatus.PASSED } },
    };
    const dropoutWhere: Prisma.StudentWhereInput = {
      user: { active: false, deactivationReason: DeactivationReason.DROPOUT },
    };
    const cohort = this.cohortWhere(start);

    const sliceResults = await Promise.all(
      this.slices().map(async ([key, slice]) => {
        const [enrolled, cEnrolled, cAppeared, cPassed, cDropout, placed] = await Promise.all([
          count({ admissionYear: year }, slice),
          count(cohort, slice),
          count(cohort, appearedWhere, slice),
          count(cohort, passedWhere, slice),
          count(cohort, dropoutWhere, slice),
          count(cohort, { isPlaced: true }, slice),
        ]);
        return { key, enrolled, cEnrolled, cAppeared, cPassed, cDropout, placed };
      }),
    );

    const by = Object.fromEntries(sliceResults.map((s) => [s.key, s]));
    const result = (k: 'total' | 'girls' | 'sc'): CmResultCell => ({ appeared: by[k].cAppeared, passed: by[k].cPassed });
    const dropout = (k: 'total' | 'girls' | 'sc'): CmDropoutCell => ({
      enrolled: by[k].cEnrolled,
      appeared: by[k].cAppeared,
      dropout: by[k].cDropout,
    });

    return {
      label,
      institutionCount,
      sanctionedSeats: seats._sum.sanctionedSeats ?? 0,
      enrolment: { total: by.total.enrolled, girls: by.girls.enrolled, sc: by.sc.enrolled },
      result: { total: result('total'), girls: result('girls'), sc: result('sc') },
      dropout: { total: dropout('total'), girls: dropout('girls'), sc: dropout('sc') },
      placement: { total: by.total.placed, girls: by.girls.placed, sc: by.sc.placed },
    };
  }

  private async teachingVacancy(types: InstitutionType[], year: number) {
    const rows = await this.prisma.branchStaffCapacity.findMany({
      where: { isActive: true, institution: { type: { in: types } } },
      select: { institutionId: true, academicYear: true, sanctionedPosts: true, filledPosts: true },
    });
    // Per institution: the report year if present, else its latest year.
    const current = academicYearLabel(year);
    const byInst = new Map<string, typeof rows>();
    rows.forEach((r) => byInst.set(r.institutionId, [...(byInst.get(r.institutionId) || []), r]));
    let sanctioned = 0;
    let filled = 0;
    byInst.forEach((list) => {
      const years = [...new Set(list.map((r) => r.academicYear))];
      const pick = years.includes(current) ? current : years.sort().pop();
      list
        .filter((r) => r.academicYear === pick)
        .forEach((r) => {
          sanctioned += r.sanctionedPosts;
          filled += r.filledPosts;
        });
    });
    return { sanctioned, filled, vacant: Math.max(sanctioned - filled, 0) };
  }

  // ---------- Complete Information (Courses) ----------

  async getCollegeInfo(institutionId: string, year: number) {
    const institution = await this.prisma.institution.findUnique({ where: { id: institutionId } });
    if (!institution) throw new NotFoundException(`Institution with ID ${institutionId} not found`);

    const [students, staff, capacities, intakes, infra] = await Promise.all([
      this.prisma.student.findMany({
        where: { institutionId },
        select: {
          branchId: true,
          admissionYear: true,
          user: { select: { active: true, deactivationReason: true } },
        },
      }),
      this.prisma.user.findMany({
        where: { institutionId, role: { in: [Role.TEACHER, Role.PRINCIPAL] }, active: true },
        select: { branchId: true, designationEnum: true, guestTeacher: true },
      }),
      this.prisma.branchStaffCapacity.findMany({ where: { institutionId, isActive: true } }),
      this.prisma.branchIntake.findMany({ where: { institutionId, isActive: true } }),
      this.prisma.branchInfrastructure.findMany({ where: { institutionId } }),
    ]);

    // Course list = any branch this college has students, staff, intake or infra for.
    const branchIds = new Set<string>();
    [...students, ...staff].forEach((r) => r.branchId && branchIds.add(r.branchId));
    [...capacities, ...intakes, ...infra].forEach((r) => branchIds.add(r.branchId));
    const branches = await this.prisma.branch.findMany({
      where: { OR: [{ id: { in: [...branchIds] } }, { institutionId }] },
      orderBy: { name: 'asc' },
    });

    const years = [year, year - 1, year - 2];

    const courses = branches.map((b) => {
      const st = students.filter((s) => s.branchId === b.id);
      const enrolment = years.map((y) => st.filter((s) => s.admissionYear === y).length);
      const onRoll = years.map((y) => st.filter((s) => s.admissionYear === y && s.user?.active !== false).length);
      const dropouts = years.map(
        (y) =>
          st.filter(
            (s) =>
              s.admissionYear === y &&
              s.user?.active === false &&
              s.user?.deactivationReason === DeactivationReason.DROPOUT,
          ).length,
      );
      const fac = staff.filter((s) => s.branchId === b.id && !s.guestTeacher);
      const des = (list: Designation[]) => fac.filter((s) => s.designationEnum && list.includes(s.designationEnum)).length;
      const supporting = staff.filter((s) => s.branchId === b.id);
      const sup = (list: Designation[]) =>
        supporting.filter((s) => s.designationEnum && list.includes(s.designationEnum)).length;
      const known = new Set<Designation>([
        ...TEACHING_DESIGNATIONS,
        ...WORKSHOP_SUPERINTENDENT,
        ...WORKSHOP_FOREMAN,
        ...WORKSHOP_INSTRUCTOR,
        Designation.LAB_TECHNICIAN,
        Designation.TECHNICIAN,
        Designation.PRINCIPAL,
      ]);
      const infraRows = infra.filter((r) => r.branchId === b.id);
      const infraOf = (t: CoveredAreaEntityType) => infraRows.find((r) => r.entityType === t);
      return {
        name: b.name,
        enrolment,
        onRoll,
        dropouts,
        faculty: {
          head: des([Designation.HOD]),
          seniorLecturer: des([Designation.SENIOR_LECTURER]),
          lecturer: des([Designation.LECTURER, Designation.ASSISTANT_PROFESSOR]),
        },
        supporting: {
          labTechnician: sup([Designation.LAB_TECHNICIAN]),
          labAttendant: sup([Designation.TECHNICIAN]),
          other: supporting.filter((s) => s.designationEnum && !known.has(s.designationEnum)).length,
        },
        infra: {
          classrooms: infraOf(CoveredAreaEntityType.LECTURE_ROOMS)?.numberOfRooms ?? null,
          furniture: infraOf(CoveredAreaEntityType.LECTURE_ROOMS)?.furnitureAvailable ?? null,
          smartBoards: infraOf(CoveredAreaEntityType.LECTURE_ROOMS)?.smartBoardsCount ?? null,
          labs: infraOf(CoveredAreaEntityType.LABS)?.numberOfRooms ?? null,
          workshops: infraOf(CoveredAreaEntityType.WORKSHOPS)?.numberOfRooms ?? null,
        },
      };
    });

    // Section 2 / 6: staff by designation (sanctioned posts are stored per course, not per designation)
    const current = academicYearLabel(year);
    const capYears = [...new Set(capacities.map((c) => c.academicYear))];
    const capYear = capYears.includes(current) ? current : capYears.sort().pop();
    const capRows = capacities.filter((c) => c.academicYear === capYear);
    const sanctionedTotal = capRows.reduce((s, c) => s + c.sanctionedPosts, 0);

    const regular = staff.filter((s) => !s.guestTeacher);
    const countDes = (list: Designation[]) => regular.filter((s) => s.designationEnum && list.includes(s.designationEnum)).length;
    const teachingRows = [
      { designation: 'Head of Department', filled: countDes([Designation.HOD]) },
      { designation: 'Senior Lecturer', filled: countDes([Designation.SENIOR_LECTURER]) },
      { designation: 'Lecturer', filled: countDes([Designation.LECTURER, Designation.ASSISTANT_PROFESSOR]) },
    ];
    const teachingFilled = teachingRows.reduce((s, r) => s + r.filled, 0);

    const nonTeachingList: Array<[string, Designation[]]> = [
      ['Lab Technician', [Designation.LAB_TECHNICIAN]],
      ['Technician', [Designation.TECHNICIAN]],
      ['Librarian', [Designation.LIBRARIAN]],
      ['Computer Operator', [Designation.COMPUTER_OPERATOR]],
      ['Peon', [Designation.PEON]],
    ];
    const nonTeachingRows = nonTeachingList.map(([designation, list]) => ({ designation, filled: countDes(list) }));

    const workshopBranches = courses.filter((c) => (c.infra.workshops ?? 0) > 0).length;
    const workshop = {
      trades: workshopBranches,
      workshops: courses.reduce((s, c) => s + (c.infra.workshops ?? 0), 0),
      superintendents: countDes(WORKSHOP_SUPERINTENDENT),
      foremen: countDes(WORKSHOP_FOREMAN),
      instructors: countDes(WORKSHOP_INSTRUCTOR),
    };

    return {
      year,
      yearLabels: years.map(academicYearLabel),
      institution: {
        name: institution.name || institution.shortName || institution.code || '',
        hasLibrary: institution.hasLibrary,
        libraryAictBooksAvailable: institution.libraryAictBooksAvailable,
        hasCollegeBus: institution.hasCollegeBus,
        busHasDriver: institution.busHasDriver,
        computersCount: institution.computersCount,
        computersAllInternetConnected: institution.computersAllInternetConnected,
      },
      courses,
      teaching: { rows: teachingRows, sanctionedTotal, filledTotal: teachingFilled },
      workshop,
      nonTeaching: { rows: nonTeachingRows },
      generatedAt: new Date().toISOString(),
    };
  }
}

export type CollegeInfoData = Awaited<ReturnType<StateCmReportService['getCollegeInfo']>>;
