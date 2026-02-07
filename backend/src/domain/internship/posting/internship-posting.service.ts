import { Injectable, BadRequestException } from '@nestjs/common';

export interface CreatePostingDto {
  title: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  stipend?: number;
  duration?: number;
  location?: string;
  startDate?: Date;
  endDate?: Date;
  applicationDeadline?: Date;
  numberOfPositions?: number;
  skills?: string[];
  benefits?: string;
}

export interface UpdatePostingDto extends Partial<CreatePostingDto> {
  isActive?: boolean;
}

export interface PostingFilters {
  location?: string;
  minStipend?: number;
  maxStipend?: number;
  skills?: string[];
  isActive?: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * STUB: Industry-posted internship feature has been removed.
 * Only self-identified internships are supported.
 * See SelfIdentifiedService for active internship functionality.
 */
@Injectable()
export class InternshipPostingService {
  async createPosting(industryId: string, data: CreatePostingDto) {
    throw new BadRequestException(
      'Industry-posted internship feature has been removed. Only self-identified internships are supported.',
    );
  }

  async updatePosting(id: string, data: UpdatePostingDto) {
    throw new BadRequestException(
      'Industry-posted internship feature has been removed. Only self-identified internships are supported.',
    );
  }

  async deletePosting(id: string) {
    throw new BadRequestException(
      'Industry-posted internship feature has been removed. Only self-identified internships are supported.',
    );
  }

  async getPostingsByIndustry(industryId: string) {
    throw new BadRequestException(
      'Industry-posted internship feature has been removed. Only self-identified internships are supported.',
    );
  }

  async getAvailablePostings(filters: PostingFilters = {}, pagination: PaginationParams = {}) {
    throw new BadRequestException(
      'Industry-posted internship feature has been removed. Only self-identified internships are supported.',
    );
  }
}
