import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsInt,
  IsEnum,
  Min,
  Max,
  IsUrl,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InstitutionType } from '../../../generated/prisma/client';

export { InstitutionType };

export class CreateInstitutionDto {
  @ApiPropertyOptional({ description: 'Unique institution code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Full name of the institution' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Short name or abbreviation' })
  @IsOptional()
  @IsString()
  shortName?: string;

  @ApiPropertyOptional({ enum: InstitutionType, default: InstitutionType.POLYTECHNIC })
  @IsOptional()
  @IsEnum(InstitutionType)
  type?: InstitutionType;

  @ApiPropertyOptional({ description: 'Institution address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State', default: 'Punjab' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'District' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: 'PIN Code' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN code must be 6 digits' })
  pinCode?: string;

  @ApiPropertyOptional({ description: 'Country', default: 'India' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Contact email address' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone number must be 10-15 digits, optionally with + prefix' })
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Alternate phone number' })
  @IsOptional()
  @IsString()
  alternatePhone?: string;

  @ApiPropertyOptional({ description: 'Institution website URL' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ description: 'Year institution was established' })
  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(new Date().getFullYear())
  establishedYear?: number;

  @ApiPropertyOptional({ description: 'University/Board affiliation' })
  @IsOptional()
  @IsString()
  affiliatedTo?: string;

  @ApiPropertyOptional({ description: 'Recognition body (AICTE, UGC, etc.)' })
  @IsOptional()
  @IsString()
  recognizedBy?: string;

  @ApiPropertyOptional({ description: 'NAAC grade' })
  @IsOptional()
  @IsString()
  naacGrade?: string;

  @ApiPropertyOptional({ description: 'Autonomous status', default: false })
  @IsOptional()
  @IsBoolean()
  autonomousStatus?: boolean;

  @ApiPropertyOptional({ description: 'Total allocated student seats' })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalStudentSeats?: number;

  @ApiPropertyOptional({ description: 'Total allocated staff seats' })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalStaffSeats?: number;

  @ApiPropertyOptional({ description: 'Whether institution is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
