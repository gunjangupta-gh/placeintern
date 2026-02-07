# Migration Examples: Refactoring Services to Use Pagination Utility

This document shows how to refactor existing service methods to use the new pagination utility.

## Pattern Analysis

### Common Pattern Found

Across `student.service.ts`, `faculty.service.ts`, and `principal.service.ts`, the following pattern was repeated:

```typescript
// 1. Extract page and limit from params
const { page = 1, limit = 10, ...otherParams } = params;

// 2. Calculate skip value
const skip = (page - 1) * limit;

// 3. Build where clause
const where: Prisma.ModelWhereInput = { /* conditions */ };

// 4. Run query with Promise.all
const [items, total] = await Promise.all([
  this.prisma.model.findMany({
    where,
    skip,
    take: limit,
    include: { /* relations */ },
    orderBy: { /* order */ },
  }),
  this.prisma.model.count({ where }),
]);

// 5. Return formatted response
return {
  items, // or data, or specific key like 'students'
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
};
```

## Refactoring Examples

### Example 1: Student Service - getAvailableInternships

**BEFORE:**
```typescript
async getAvailableInternships(studentId: string, params: {
  page?: number;
  limit?: number;
  search?: string;
  industryType?: string;
  location?: string;
}) {
  const { page = 1, limit = 10, search, industryType, location } = params;
  const skip = (page - 1) * limit;

  const student = await this.prisma.student.findUnique({
    where: { id: studentId },
    select: { branchName: true, currentSemester: true },
  });

  if (!student) {
    throw new NotFoundException('Student not found');
  }

  const where: Prisma.InternshipWhereInput = {
    status: InternshipStatus.ACTIVE,
    isActive: true,
    applicationDeadline: { gte: new Date() },
  };

  if (student.branchName) {
    where.eligibleBranches = { has: student.branchName };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (location) {
    where.workLocation = { contains: location, mode: 'insensitive' };
  }

  if (industryType) {
    where.industry = { industryType: industryType as any };
  }

  const [internships, total] = await Promise.all([
    this.prisma.internship.findMany({
      where,
      skip,
      take: limit,
      include: {
        industry: {
          select: {
            id: true,
            companyName: true,
            industryType: true,
            city: true,
            state: true,
          },
        },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.internship.count({ where }),
  ]);

  // Additional logic to check applications...
  const internshipsWithStatus = internships.map(internship => ({
    ...internship,
    hasApplied: applicationsMap.has(internship.id),
    applicationStatus: applicationsMap.get(internship.id) || null,
  }));

  return {
    internships: internshipsWithStatus,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
```

**AFTER (Option 1 - Using executePaginatedQuery):**
```typescript
import { executePaginatedQuery } from '@/common/utils';

async getAvailableInternships(studentId: string, params: {
  page?: number;
  limit?: number;
  search?: string;
  industryType?: string;
  location?: string;
}) {
  const { search, industryType, location } = params;

  const student = await this.prisma.student.findUnique({
    where: { id: studentId },
    select: { branchName: true, currentSemester: true },
  });

  if (!student) {
    throw new NotFoundException('Student not found');
  }

  const where: Prisma.InternshipWhereInput = {
    status: InternshipStatus.ACTIVE,
    isActive: true,
    applicationDeadline: { gte: new Date() },
  };

  if (student.branchName) {
    where.eligibleBranches = { has: student.branchName };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (location) {
    where.workLocation = { contains: location, mode: 'insensitive' };
  }

  if (industryType) {
    where.industry = { industryType: industryType as any };
  }

  const result = await executePaginatedQuery(
    (skip, take) => this.prisma.internship.findMany({
      where,
      skip,
      take,
      include: {
        industry: {
          select: {
            id: true,
            companyName: true,
            industryType: true,
            city: true,
            state: true,
          },
        },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    () => this.prisma.internship.count({ where }),
    params,
    { dataKey: 'internships' }
  );

  // Additional logic to check applications...
  const internshipsWithStatus = result.internships.map(internship => ({
    ...internship,
    hasApplied: applicationsMap.has(internship.id),
    applicationStatus: applicationsMap.get(internship.id) || null,
  }));

  return {
    ...result,
    internships: internshipsWithStatus,
  };
}
```

**AFTER (Option 2 - Using individual functions):**
```typescript
import { calculatePagination, formatPaginatedResponse } from '@/common/utils';

async getAvailableInternships(studentId: string, params: {
  page?: number;
  limit?: number;
  search?: string;
  industryType?: string;
  location?: string;
}) {
  const { search, industryType, location } = params;
  const { page, limit, skip } = calculatePagination(params);

  const student = await this.prisma.student.findUnique({
    where: { id: studentId },
    select: { branchName: true, currentSemester: true },
  });

  if (!student) {
    throw new NotFoundException('Student not found');
  }

  const where: Prisma.InternshipWhereInput = {
    status: InternshipStatus.ACTIVE,
    isActive: true,
    applicationDeadline: { gte: new Date() },
  };

  if (student.branchName) {
    where.eligibleBranches = { has: student.branchName };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (location) {
    where.workLocation = { contains: location, mode: 'insensitive' };
  }

  if (industryType) {
    where.industry = { industryType: industryType as any };
  }

  const [internships, total] = await Promise.all([
    this.prisma.internship.findMany({
      where,
      skip,
      take: limit,
      include: {
        industry: {
          select: {
            id: true,
            companyName: true,
            industryType: true,
            city: true,
            state: true,
          },
        },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.internship.count({ where }),
  ]);

  // Additional logic to check applications...
  const internshipsWithStatus = internships.map(internship => ({
    ...internship,
    hasApplied: applicationsMap.has(internship.id),
    applicationStatus: applicationsMap.get(internship.id) || null,
  }));

  return formatPaginatedResponse(internshipsWithStatus, total, page, limit, 'internships');
}
```

### Example 2: Faculty Service - getAssignedStudents

**BEFORE:**
```typescript
async getAssignedStudents(
  facultyId: string,
  params: { page?: number; limit?: number; search?: string },
) {
  const { page = 1, limit = 10, search } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.MentorAssignmentWhereInput = {
    mentorId: facultyId,
    isActive: true,
  };

  if (search) {
    where.student = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { rollNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [assignments, total] = await Promise.all([
    this.prisma.mentorAssignment.findMany({
      where,
      skip,
      take: limit,
      include: {
        student: {
          include: {
            batch: true,
            branch: true,
            internshipApplications: {
              where: { mentorId: facultyId },
              include: {
                internship: { include: { industry: true } },
              },
            },
            _count: { select: { monthlyReports: true } },
          },
        },
      },
      orderBy: { assignmentDate: 'desc' },
    }),
    this.prisma.mentorAssignment.count({ where }),
  ]);

  return {
    students: assignments.map(a => a.student),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
```

**AFTER:**
```typescript
import { executePaginatedQuery } from '@/common/utils';

async getAssignedStudents(
  facultyId: string,
  params: { page?: number; limit?: number; search?: string },
) {
  const { search } = params;

  const where: Prisma.MentorAssignmentWhereInput = {
    mentorId: facultyId,
    isActive: true,
  };

  if (search) {
    where.student = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { rollNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const result = await executePaginatedQuery(
    (skip, take) => this.prisma.mentorAssignment.findMany({
      where,
      skip,
      take,
      include: {
        student: {
          include: {
            batch: true,
            branch: true,
            internshipApplications: {
              where: { mentorId: facultyId },
              include: {
                internship: { include: { industry: true } },
              },
            },
            _count: { select: { monthlyReports: true } },
          },
        },
      },
      orderBy: { assignmentDate: 'desc' },
    }),
    () => this.prisma.mentorAssignment.count({ where }),
    params
  );

  return {
    ...result,
    students: result.data.map(a => a.student),
  };
}
```

### Example 3: Principal Service - getStudents

**BEFORE:**
```typescript
async getStudents(principalId: string, query: {
  page?: number;
  limit?: number;
  search?: string;
  batchId?: string;
  branchId?: string;
  isActive?: boolean;
}) {
  const principal = await this.prisma.user.findUnique({
    where: { id: principalId },
  });

  if (!principal || !principal.institutionId) {
    throw new NotFoundException('Institution not found');
  }

  const { page = 1, limit = 10, search, batchId, branchId, isActive } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.StudentWhereInput = {
    institutionId: principal.institutionId,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { rollNumber: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (batchId) where.batchId = batchId;
  if (branchId) where.branchId = branchId;
  if (isActive !== undefined) where.isActive = isActive;

  const [students, total] = await Promise.all([
    this.prisma.student.findMany({
      where,
      skip,
      take: limit,
      include: {
        batch: true,
        branch: true,
        user: {
          select: {
            id: true,
            email: true,
            active: true,
          },
        },
        _count: {
          select: {
            internshipApplications: true,
            monthlyReports: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.student.count({ where }),
  ]);

  return {
    data: students,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
```

**AFTER:**
```typescript
import { executePaginatedQuery } from '@/common/utils';

async getStudents(principalId: string, query: {
  page?: number;
  limit?: number;
  search?: string;
  batchId?: string;
  branchId?: string;
  isActive?: boolean;
}) {
  const principal = await this.prisma.user.findUnique({
    where: { id: principalId },
  });

  if (!principal || !principal.institutionId) {
    throw new NotFoundException('Institution not found');
  }

  const { search, batchId, branchId, isActive } = query;

  const where: Prisma.StudentWhereInput = {
    institutionId: principal.institutionId,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { rollNumber: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (batchId) where.batchId = batchId;
  if (branchId) where.branchId = branchId;
  if (isActive !== undefined) where.isActive = isActive;

  return executePaginatedQuery(
    (skip, take) => this.prisma.student.findMany({
      where,
      skip,
      take,
      include: {
        batch: true,
        branch: true,
        user: {
          select: {
            id: true,
            email: true,
            active: true,
          },
        },
        _count: {
          select: {
            internshipApplications: true,
            monthlyReports: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    () => this.prisma.student.count({ where }),
    query
  );
}
```

## Methods Ready for Refactoring

### Student Service (D:\Github\New folder\cms-new\backend\src\api\student-portal\student.service.ts)
- ✓ `getAvailableInternships` (lines 231-349)
- ✓ `getApplications` (lines 433-492)
- ✓ `getSelfIdentified` (lines 607-633)
- ✓ `getDocuments` (lines 723-749)
- ✓ `getMonthlyReports` (lines 781-820)
- ✓ `getGrievances` (lines 868-921)

### Faculty Service (D:\Github\New folder\cms-new\backend\src\api\faculty\faculty.service.ts)
- ✓ `getAssignedStudents` (lines 173-237)
- ✓ `getVisitLogs` (lines 314-372)
- ✓ `getMonthlyReports` (lines 480-537)
- ✓ `getSelfIdentifiedApprovals` (lines 591-637)
- ✓ `getFeedbackHistory` (lines 728-785)

### Principal Service (D:\Github\New folder\cms-new\backend\src\api\principal\principal.service.ts)
- ✓ `getStudents` (lines 246-323)
- ✓ `getStaff` (lines 538-598)
- ✓ `getStudentReports` (lines 872-897)
- ✓ `getFacultyVisitReports` (lines 902-934)
- ✓ `getMonthlyReports` (lines 939-968)

## Benefits of Refactoring

1. **Code Reduction**: ~10-15 lines saved per method
2. **Consistency**: All pagination works the same way
3. **Maintainability**: Changes to pagination logic only need to be made in one place
4. **Type Safety**: Proper TypeScript types ensure correctness
5. **Testing**: Easier to test pagination logic in isolation
6. **Documentation**: All pagination behavior documented in one place

## Next Steps

1. Import the utility in each service file
2. Refactor one method at a time
3. Test each refactored method
4. Update any dependent tests
5. Document the changes in the service files
