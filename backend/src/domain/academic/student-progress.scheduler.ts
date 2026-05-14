import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../core/database/prisma.service';

/**
 * Scheduler for updating student academic progress (currentYear and currentSemester)
 *
 * Academic year runs from July to June:
 * - July 1st: New academic year starts (odd semester: 1, 3, 5)
 * - January 1st: Even semester starts (even semester: 2, 4, 6)
 *
 * currentYear is calculated as: currentAcademicYear - admissionYear + 1
 * currentSemester is calculated as: (currentYear - 1) * 2 + (1 for odd, 2 for even)
 */
@Injectable()
export class StudentProgressScheduler {
  private readonly logger = new Logger(StudentProgressScheduler.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Update student year and semester on July 1st (new academic year)
   * Runs at 00:01 AM on July 1st
   */
  @Cron('0 1 0 1 7 *')
  async updateOnAcademicYearStart(): Promise<void> {
    this.logger.log('Starting academic year update (July 1st)');
    await this.updateStudentProgress('odd');
  }

  /**
   * Update student semester on January 1st (even semester start)
   * Runs at 00:01 AM on January 1st
   */
  @Cron('0 1 0 1 1 *')
  async updateOnEvenSemesterStart(): Promise<void> {
    this.logger.log('Starting even semester update (January 1st)');
    await this.updateStudentProgress('even');
  }

  /**
   * Core logic for updating student academic progress
   * @param semesterType 'odd' for July (semester 1,3,5) or 'even' for January (semester 2,4,6)
   */
  async updateStudentProgress(semesterType: 'odd' | 'even'): Promise<{ updated: number; skipped: number }> {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12

    // Determine current academic year
    // If month >= 7 (July), academic year = current year
    // If month < 7, academic year = current year - 1
    const currentAcademicYear = currentMonth >= 7 ? now.getFullYear() : now.getFullYear() - 1;

    this.logger.log(`Current academic year: ${currentAcademicYear}, Semester type: ${semesterType}`);

    // Fetch all active students with admissionYear set
    const students = await this.prisma.student.findMany({
      where: {
        admissionYear: { not: null },
        user: { active: true },
      },
      select: {
        id: true,
        admissionYear: true,
        currentYear: true,
        currentSemester: true,
      },
    });

    this.logger.log(`Found ${students.length} students to process`);

    let updated = 0;
    let skipped = 0;

    for (const student of students) {
      try {
        if (!student.admissionYear) {
          skipped++;
          continue;
        }

        // Calculate current year (1-based)
        // Year 1: admissionYear
        // Year 2: admissionYear + 1
        // Year 3: admissionYear + 2
        const calculatedYear = currentAcademicYear - student.admissionYear + 1;

        // Skip if student has completed their course (year > 3 for typical 3-year course)
        // or if they haven't started yet (year < 1)
        if (calculatedYear < 1 || calculatedYear > 4) {
          skipped++;
          continue;
        }

        // Calculate semester
        // Year 1: Semesters 1, 2
        // Year 2: Semesters 3, 4
        // Year 3: Semesters 5, 6
        const baseSemester = (calculatedYear - 1) * 2;
        const calculatedSemester = semesterType === 'odd' ? baseSemester + 1 : baseSemester + 2;

        // Cap semester at 6 (typical 3-year course)
        const finalSemester = Math.min(calculatedSemester, 6);
        const finalYear = Math.min(calculatedYear, 3);

        // Only update if values have changed
        if (student.currentYear !== finalYear || student.currentSemester !== finalSemester) {
          await this.prisma.student.update({
            where: { id: student.id },
            data: {
              currentYear: finalYear,
              currentSemester: finalSemester,
            },
          });
          updated++;
        } else {
          skipped++;
        }
      } catch (error) {
        this.logger.warn(`Failed to update student ${student.id}: ${error.message}`);
        skipped++;
      }
    }

    this.logger.log(`Academic progress update complete: ${updated} updated, ${skipped} skipped`);
    return { updated, skipped };
  }

  /**
   * Manual trigger for testing/admin purposes
   */
  async manualUpdate(semesterType: 'odd' | 'even'): Promise<{ updated: number; skipped: number }> {
    this.logger.log(`Manual academic progress update triggered for ${semesterType} semester`);
    return this.updateStudentProgress(semesterType);
  }
}
