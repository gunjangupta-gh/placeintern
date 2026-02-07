import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsEmail,
  IsArray,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '../../../generated/prisma/client';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsString()
  phoneNo?: string;

  @IsOptional()
  @IsString()
  institutionId?: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  designation?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  phoneNo?: string;

  @IsOptional()
  @IsString()
  institutionId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  designation?: string;
}

export class UserQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  institutionId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class BulkUserActionDto {
  @IsEnum(['activate', 'deactivate', 'delete', 'resetPassword'])
  action: 'activate' | 'deactivate' | 'delete' | 'resetPassword';

  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}

export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  institutionId?: string;
  institutionName?: string;
  phoneNo?: string;
  lastLoginAt?: Date;
  createdAt: Date;
}

export class UsersListResponseDto {
  users: UserResponseDto[];
  total: number;
  page: number;
  totalPages: number;
  roleStats: Record<string, number>;
}
