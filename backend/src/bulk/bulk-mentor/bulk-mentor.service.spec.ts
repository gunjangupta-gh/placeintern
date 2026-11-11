import { BulkMentorService, currentAcademicYear } from './bulk-mentor.service';

const INST = 'inst-1';

const build = (students: any[], mentors: any[]) => {
  const tx = {
    mentorAssignment: { updateMany: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({}) },
  };
  const prisma: any = {
    student: { findMany: jest.fn().mockResolvedValue(students) },
    user: { findMany: jest.fn().mockResolvedValue(mentors), findUnique: jest.fn().mockResolvedValue({ name: 'P', role: 'PRINCIPAL' }) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const cache: any = { invalidateByTags: jest.fn().mockResolvedValue(undefined) };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  return { svc: new BulkMentorService(prisma, cache, audit), prisma, tx, cache, audit };
};

const stu = (id: string, roll: string, mentor?: { id: string; name: string }) => ({
  id,
  user: { name: `Student ${roll}`, rollNumber: roll },
  mentorAssignments: mentor ? [{ mentorId: mentor.id, mentor: { name: mentor.name } }] : [],
});
const mentorA = { id: 'm1', name: 'Mentor A', email: 'a@x.in' };
const mentorB = { id: 'm2', name: 'Mentor B', email: 'b@x.in' };

describe('BulkMentorService', () => {
  it('academic year runs July to June', () => {
    expect(currentAcademicYear(new Date('2026-08-01'))).toBe('2026-27');
    expect(currentAcademicYear(new Date('2026-02-01'))).toBe('2025-26');
  });

  it('classifies rows and applies only valid ones in one transaction', async () => {
    const { svc, tx, cache } = build(
      [stu('s1', 'R1'), stu('s2', 'R2', { id: 'm1', name: 'Mentor A' }), stu('s3', 'R3', { id: 'm1', name: 'Mentor A' })],
      [mentorA, mentorB],
    );
    const rows = [
      { rowNumber: 2, rollNumber: 'R1', mentorEmail: 'a@x.in' }, // new
      { rowNumber: 3, rollNumber: 'R2', mentorEmail: 'b@x.in' }, // reassign
      { rowNumber: 4, rollNumber: 'R3', mentorEmail: 'a@x.in' }, // unchanged
      { rowNumber: 5, rollNumber: 'R9', mentorEmail: 'a@x.in' }, // unknown student
      { rowNumber: 6, rollNumber: 'R1', mentorEmail: 'b@x.in' }, // duplicate roll
      { rowNumber: 7, rollNumber: 'R2', mentorEmail: 'zz@x.in' }, // dup too
      { rowNumber: 8, rollNumber: 'R4', mentorEmail: 'zz@x.in' }, // unknown mentor
    ];
    const res = await svc.process('principal-1', INST, rows, false, '2026-27');
    expect(res).toMatchObject({ total: 7, newAssignments: 1, reassignments: 1, unchanged: 1, failed: 4, willAssign: 2 });
    const created = tx.mentorAssignment.createMany.mock.calls[0][0].data;
    expect(created.map((c: any) => [c.studentId, c.mentorId])).toEqual([['s1', 'm1'], ['s2', 'm2']]);
    expect(created.every((c: any) => c.assignedBy === 'principal-1' && c.academicYear === '2026-27')).toBe(true);
    expect(tx.mentorAssignment.updateMany.mock.calls[0][0].where.studentId.in).toEqual(['s1', 's2']);
    expect(cache.invalidateByTags).toHaveBeenCalled();
  });

  it('dry run saves nothing', async () => {
    const { svc, prisma } = build([stu('s1', 'R1')], [mentorA]);
    const res = await svc.process('p', INST, [{ rowNumber: 2, rollNumber: 'R1', mentorEmail: 'a@x.in' }], true);
    expect(res.dryRun).toBe(true);
    expect(res.willAssign).toBe(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('scopes lookups to the principal institution', async () => {
    const { svc, prisma } = build([], []);
    await svc.process('p', INST, [{ rowNumber: 2, rollNumber: 'R1', mentorEmail: 'a@x.in' }], true);
    expect(prisma.student.findMany.mock.calls[0][0].where.institutionId).toBe(INST);
    expect(prisma.user.findMany.mock.calls[0][0].where.institutionId).toBe(INST);
  });

  it('reports missing fields', async () => {
    const { svc } = build([], []);
    const res = await svc.process('p', INST, [{ rowNumber: 2, mentorEmail: 'a@x.in' }, { rowNumber: 3, rollNumber: 'R1' }], true);
    expect(res.rows.map((r) => r.error)).toEqual(['Roll Number is required', 'Mentor Email is required']);
  });

  it('template downloads pre-filled and reads back (only Roll Number / Mentor Email / Notes are used)', async () => {
    const { svc, prisma } = build(
      [{ ...stu('s1', 'R1', { id: 'm1', name: 'Mentor A' }), branch: { name: 'CSE' }, currentYear: 2 }],
      [{ id: 'm1', name: 'Mentor A', email: 'a@x.in', designation: 'Lecturer' }],
    );
    prisma.mentorAssignment = { groupBy: jest.fn().mockResolvedValue([{ mentorId: 'm1', _count: { _all: 3 } }]) };
    const buf = await svc.getTemplate(INST);
    const rows = await svc.parseFile(buf);
    // Mentor Email is blank in the template, so the pre-filled row is read as roll number only
    expect(rows).toEqual([{ rowNumber: 2, rollNumber: 'R1', mentorEmail: undefined, notes: undefined }]);
  });

  it('rejects an empty file', async () => {
    const { svc } = build([], []);
    await expect(svc.process('p', INST, [], true)).rejects.toThrow('No rows');
  });
});
