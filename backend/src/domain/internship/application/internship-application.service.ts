import { Injectable, BadRequestException } from '@nestjs/common';

export interface CreateApplicationDto {
  coverLetter?: string;
  resume?: string;
  additionalInfo?: string;
}

export interface UpdateApplicationStatusDto {
  status: string;
  remarks?: string;
}

/**
 * STUB: Industry-posted internship application feature has been removed.
 * Only self-identified internships are supported.
 * See SelfIdentifiedService for active internship functionality.
 */
@Injectable()
export class InternshipApplicationService {
  async createApplication(studentId: string, internshipId: string, data: CreateApplicationDto) {
    throw new BadRequestException(
      'Industry-posted internship applications are no longer supported. Please use self-identified internships instead.',
    );
  }

  async getApplicationsByStudent(studentId: string) {
    throw new BadRequestException(
      'Industry-posted internship applications are no longer supported. Please use self-identified internships instead.',
    );
  }

  async getApplicationsByInternship(internshipId: string) {
    throw new BadRequestException(
      'Industry-posted internship applications are no longer supported. Please use self-identified internships instead.',
    );
  }

  async updateApplicationStatus(id: string, status: UpdateApplicationStatusDto['status'], remarks?: string) {
    throw new BadRequestException(
      'Industry-posted internship applications are no longer supported. Please use self-identified internships instead.',
    );
  }

  async withdrawApplication(id: string) {
    throw new BadRequestException(
      'Industry-posted internship applications are no longer supported. Please use self-identified internships instead.',
    );
  }
}
