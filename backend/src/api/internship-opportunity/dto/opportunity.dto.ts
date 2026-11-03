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
  Max,
  MaxLength,
  Min,
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
}

export class IncompleteProfilesQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() branchId?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

export class UpdateOpportunityDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(80) district?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) positions?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) durationMonths?: number;
  @IsOptional() @IsString() @MaxLength(50) stipend?: string;
  @IsOptional() @Matches(DATE_RE, { message: 'startDate must be yyyy-mm-dd' }) startDate?: string;
  @IsOptional() @Matches(DATE_RE, { message: 'applicationDeadline must be yyyy-mm-dd' }) applicationDeadline?: string;
  @IsOptional() @IsIn(['DRAFT', 'OPEN', 'CLOSED']) status?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsInt({ each: true }) @IsIn([1, 2, 3], { each: true }) eligibleYears?: number[];
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsUUID('all', { each: true }) branchIds?: string[];
  @IsOptional() @IsString() @MaxLength(100) contactName?: string;
  @IsOptional() @IsString() @MaxLength(20) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(100) contactEmail?: string;
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
  @IsIn(['APPROVE', 'REJECT']) action!: 'APPROVE' | 'REJECT';
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsUUID('all', { each: true }) applicationIds!: string[];
  @IsOptional() @IsString() @MaxLength(500) remarks?: string;
}
