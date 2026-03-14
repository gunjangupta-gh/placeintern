import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IssueCertificateDto {
  @ApiProperty({ description: 'User ID to issue certificate to' })
  @IsUUID()
  userId: string;
}

export class BulkIssueCertificateDto {
  @ApiProperty({ description: 'User IDs to issue certificates to' })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];
}

export class RevokeCertificateDto {
  @ApiProperty({ description: 'Reason for revocation' })
  @IsString()
  reason: string;
}

export class CertificateFilterDto {
  @ApiPropertyOptional({ description: 'Filter by training ID' })
  @IsOptional()
  @IsUUID()
  trainingId?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by validity' })
  @IsOptional()
  isValid?: boolean;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page' })
  @IsOptional()
  limit?: number = 20;
}
