import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  IsInt,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { SupportCategory } from '../../../../generated/prisma/client';

export class CreateFAQDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Title must be at least 10 characters long' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(50, { message: 'Content must be at least 50 characters long' })
  @MaxLength(10000, { message: 'Content must not exceed 10000 characters' })
  content: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Summary must not exceed 500 characters' })
  summary?: string;

  @IsEnum(SupportCategory)
  @IsNotEmpty()
  category: SupportCategory;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetRoles?: string[]; // Which roles can see this FAQ (empty = all roles)

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  searchTerms?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class UpdateFAQDto {
  @IsString()
  @IsOptional()
  @MinLength(10, { message: 'Title must be at least 10 characters long' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title?: string;

  @IsString()
  @IsOptional()
  @MinLength(50, { message: 'Content must be at least 50 characters long' })
  @MaxLength(10000, { message: 'Content must not exceed 10000 characters' })
  content?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Summary must not exceed 500 characters' })
  summary?: string;

  @IsEnum(SupportCategory)
  @IsOptional()
  category?: SupportCategory;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetRoles?: string[]; // Which roles can see this FAQ (empty = all roles)

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  searchTerms?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
