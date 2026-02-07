import { IsString, IsArray, IsUUID, ArrayMaxSize, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminResetPasswordDto {
  @ApiProperty({ description: 'User ID to reset password for' })
  @IsUUID()
  userId: string;
}

export class BulkResetPasswordDto {
  @ApiProperty({
    description: 'Array of user IDs to reset passwords for',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one user ID is required' })
  @ArrayMaxSize(100, { message: 'Cannot reset passwords for more than 100 users at once' })
  @IsUUID('4', { each: true, message: 'Each user ID must be a valid UUID' })
  userIds: string[];
}
