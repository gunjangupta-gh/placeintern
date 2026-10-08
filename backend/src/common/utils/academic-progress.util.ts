/**
 * Student academic progress (currentYear / currentSemester) derived from admissionYear.
 *
 * Academic year runs July to June:
 * - July to December: odd semester (1, 3, 5), academic year starts in the current calendar year
 * - January to June: even semester (2, 4, 6), academic year started in the previous calendar year
 *
 * Single source of truth shared by the scheduler, student creation and the
 * institution overview, so the three can never disagree.
 */

export type SemesterType = 'odd' | 'even';

export const getSemesterType = (now: Date = new Date()): SemesterType =>
  now.getMonth() + 1 >= 7 ? 'odd' : 'even';

export const getAcademicStartYear = (now: Date = new Date()): number =>
  now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;

/** Raw 1-based year of study (1 = admitted this academic year); can be <1 or >3. */
export const calculateYearOfStudy = (admissionYear: number, now: Date = new Date()): number =>
  getAcademicStartYear(now) - admissionYear + 1;

/**
 * currentYear (1-3) and currentSemester (1-6), or null when the student has not
 * started yet or is past the supported range (year > 4), matching the scheduler.
 */
export const calculateStudentProgress = (
  admissionYear: number | null | undefined,
  now: Date = new Date(),
  semesterType: SemesterType = getSemesterType(now),
): { currentYear: number; currentSemester: number } | null => {
  if (!admissionYear) return null;

  const year = calculateYearOfStudy(admissionYear, now);
  if (year < 1 || year > 4) return null;

  const baseSemester = (year - 1) * 2;
  const semester = semesterType === 'odd' ? baseSemester + 1 : baseSemester + 2;

  return {
    currentYear: Math.min(year, 3),
    currentSemester: Math.min(semester, 6),
  };
};
