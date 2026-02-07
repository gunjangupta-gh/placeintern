import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  MinLength,
  Matches,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePrincipalDto {
  @ApiProperty({ description: 'Full name of the principal' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @ApiProperty({ description: 'Email address (must be unique)' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ description: 'Password (min 8 characters)' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @ApiProperty({ description: 'Institution ID to assign the principal to' })
  @IsString()
  @IsNotEmpty({ message: 'Institution ID is required' })
  institutionId: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone number must be 10-15 digits' })
  phoneNo?: string;

  @ApiPropertyOptional({ description: 'Designation/Title' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({ description: 'Whether the principal account is active' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
