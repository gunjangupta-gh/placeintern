import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DeactivationReason } from '../../../generated/prisma/client';

// Shared by Principal, Faculty, and State-Directorate "toggle student status"
// endpoints so a deactivation reason is recorded the same way everywhere.
export class ToggleStudentStatusDto {
  @ApiProperty({
    description: 'Reason for deactivation (ignored when reactivating)',
    enum: DeactivationReason,
    required: false,
  })
  @IsEnum(DeactivationReason)
  @IsOptional()
  reason?: DeactivationReason;

  @ApiProperty({ description: 'Free-text remarks for the deactivation (ignored when reactivating)', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}
