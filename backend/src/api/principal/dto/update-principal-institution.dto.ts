import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CoveredAreaEntityType } from '../../../generated/prisma/client';
import { CreateInstitutionDto } from '../../state/dto/create-institution.dto';

// '' means "not provided"; an explicit null is kept so a field can be cleared.
// Reads the raw input (obj[key]) because @Type(Number) would otherwise turn '' into 0.
const emptyToUndefined = ({ value, obj, key }: { value: unknown; obj: any; key: string }) =>
  obj?.[key] === '' ? undefined : value;

export class PrincipalCoveredAreaDto {
  @ApiPropertyOptional({ enum: CoveredAreaEntityType })
  @IsEnum(CoveredAreaEntityType)
  entityType: CoveredAreaEntityType;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  numberOfRooms?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  requiredAreaSqFt?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  availableAreaSqFt?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  additionalRequirementSqFt?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  declaredUnsafeAreaSqFt?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  lastMajorRepairDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  futureExpansionScope?: string;

  @ApiPropertyOptional({ description: 'Whether furniture is available' })
  @IsOptional()
  @IsBoolean()
  furnitureAvailable?: boolean;

  @ApiPropertyOptional({ description: 'Number of smart boards / smart TVs' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  smartBoardsCount?: number;
}

/**
 * Fields a principal may edit on their OWN institution.
 *
 * This is an explicit allow-list (PickType), so identity/administrative fields
 * - code, type, isActive, totalStudentSeats, totalStaffSeats - are deliberately
 * absent and rejected by the global ValidationPipe (forbidNonWhitelisted).
 * The institution itself is never taken from the request: it is always the
 * authenticated principal's institution.
 */
export class UpdatePrincipalInstitutionDto extends PickType(CreateInstitutionDto, [
  'name',
  'shortName',
  'address',
  'city',
  'state',
  'district',
  'pinCode',
  'country',
  'contactEmail',
  'contactPhone',
  'alternatePhone',
  'website',
  'latitude',
  'longitude',
  'gpsMapLink',
  'totalLandAcres',
  'landOwnership',
  'hasLandDispute',
  'establishedYear',
  'affiliatedTo',
  'recognizedBy',
  'naacGrade',
  'autonomousStatus',
  'hasLibrary',
  'libraryAictBooksAvailable',
  'hasCollegeBus',
  'busHasDriver',
  'computersCount',
  'computersAllInternetConnected',
] as const) {
  @ApiPropertyOptional({ type: [PrincipalCoveredAreaDto], description: 'Covered area rows (upserted per entityType)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PrincipalCoveredAreaDto)
  coveredAreaDetails?: PrincipalCoveredAreaDto[];
}
