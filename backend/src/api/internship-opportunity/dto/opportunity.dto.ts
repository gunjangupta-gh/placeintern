import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApplicationStatus } from '../../../generated/prisma/client';

export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}

export class ListOpportunitiesQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(['DRAFT', 'OPEN', 'CLOSED', 'FILLED']) status?: string;
  @IsOptional() @IsUUID() branchId?: string;
}

export class ListApplicationsQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() opportunityId?: string;
  @IsOptional() @IsUUID() institutionId?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  /** PENDING | SELECTED | CLOSED. Takes precedence over `status` when both are sent. */
  @IsOptional() @IsIn(['PENDING', 'SELECTED', 'CLOSED']) group?: string;
}

/** Same filters as the list, for the Excel export (no paging). */
export class ExportApplicationsQueryDto {
  @IsOptional() @IsUUID() opportunityId?: string;
  @IsOptional() @IsUUID() institutionId?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  @IsOptional() @IsIn(['PENDING', 'SELECTED', 'CLOSED']) group?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}

export class IncompleteProfilesQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() branchId?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/** One branch's seats and application limit. */
export class BranchSeatDto {
  @IsUUID() branchId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(500) positions!: number;
  /** Applications this branch accepts (waiting list). Omit / null = same as positions. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2000) maxApplications?: number | null;
}

/**
 * Every field of an opportunity is editable. Send only what changed.
 * An empty string on an optional text field clears it.
 */
export class UpdateOpportunityDto {
  /** Matched to an existing company (case-insensitive) or created. */
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) companyName?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(80) district?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) durationMonths?: number;
  @IsOptional() @IsString() @MaxLength(50) stipend?: string;
  @IsOptional() @Matches(DATE_RE, { message: 'startDate must be yyyy-mm-dd' }) startDate?: string;
  @IsOptional() @Matches(DATE_RE, { message: 'applicationDeadline must be yyyy-mm-dd' }) applicationDeadline?: string;
  @IsOptional() @IsIn(['DRAFT', 'OPEN', 'CLOSED']) status?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsInt({ each: true }) @IsIn([1, 2, 3], { each: true }) eligibleYears?: number[];
  /** Branch-wise positions and application limits. Replaces the whole list. */
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => BranchSeatDto)
  branches?: BranchSeatDto[];
  @IsOptional() @IsString() @MaxLength(100) contactName?: string;
  @IsOptional() @Matches(/^$|^[0-9+\-\s()]{7,20}$/, { message: 'contactPhone is not a valid phone number' }) contactPhone?: string;
  @IsOptional() @Matches(/^$|^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/, { message: 'contactEmail is not a valid email' }) @MaxLength(100) contactEmail?: string;
}

export class ApproveApplicationDto {
  @IsOptional() @IsString() @MaxLength(500) remarks?: string;
  @IsOptional() @Matches(DATE_RE, { message: 'startDate must be yyyy-mm-dd' }) startDate?: string;
  @IsOptional() @Matches(DATE_RE, { message: 'endDate must be yyyy-mm-dd' }) endDate?: string;
}

export class RejectApplicationDto {
  @IsString() @MaxLength(500) reason!: string;
}

export class BulkApplicationActionDto {
  @IsIn(['APPROVE', 'REJECT', 'DELETE']) action!: 'APPROVE' | 'REJECT' | 'DELETE';
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsUUID('all', { each: true }) applicationIds!: string[];
  @IsOptional() @IsString() @MaxLength(500) remarks?: string;
}
