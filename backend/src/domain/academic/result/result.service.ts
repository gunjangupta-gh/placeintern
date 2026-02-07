import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface AddResultDto {
  semesterId: string;
  subjectId: string;
  marksObtained: number;
  totalMarks?: number;
  grade?: string;
  credits?: number;
  remarks?: string;
}

export interface BulkResultDto {
  studentId: string;
  results: AddResultDto[];
}

@Injectable()
export class ResultService {
  private readonly logger = new Logger(ResultService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async addResult(studentId: string, data: AddResultDto) {
    throw new BadRequestException('Academic results feature has been removed');
  }

  async getResultsByStudent(studentId: string) {
    return {
      results: [],
      semesterWise: [],
      cgpa: 0,
    };
  }

  async bulkUploadResults(data: BulkResultDto[]) {
    throw new BadRequestException('Academic results feature has been removed');
  }

  private calculateGrade(marksObtained: number, totalMarks: number): string {
    const percentage = (marksObtained / totalMarks) * 100;

    if (percentage >= 90) return 'O';
    if (percentage >= 80) return 'A+';
    if (percentage >= 70) return 'A';
    if (percentage >= 60) return 'B+';
    if (percentage >= 50) return 'B';
    if (percentage >= 40) return 'C';
    return 'F';
  }

  private gradeToPoint(grade: string): number {
    const gradePoints = {
      'O': 10,
      'A+': 9,
      'A': 8,
      'B+': 7,
      'B': 6,
      'C': 5,
      'F': 0,
    };

    return gradePoints[grade] || 0;
  }

  private calculateCGPA(results: any[]): number {
    if (results.length === 0) return 0;

    let totalPoints = 0;
    let totalCredits = 0;

    for (const result of results) {
      const gradePoint = this.gradeToPoint(result.grade);
      const credits = result.credits || 1;

      totalPoints += gradePoint * credits;
      totalCredits += credits;
    }

    return totalCredits > 0 ? totalPoints / totalCredits : 0;
  }

  private groupBySemester(results: any[]): any {
    const semesterMap = new Map();

    for (const result of results) {
      const semesterId = result.semesterId;

      if (!semesterMap.has(semesterId)) {
        semesterMap.set(semesterId, {
          semester: result.semester,
          results: [],
          sgpa: 0,
        });
      }

      semesterMap.get(semesterId).results.push(result);
    }

    // Calculate SGPA for each semester
    semesterMap.forEach((semesterData) => {
      semesterData.sgpa = this.calculateCGPA(semesterData.results);
    });

    return Array.from(semesterMap.values());
  }
}
