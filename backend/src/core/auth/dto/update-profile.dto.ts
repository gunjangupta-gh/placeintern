import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name?: string;

  @IsEmail({}, { message: 'Please enter a valid email address' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{10}$/, { message: 'Please enter a valid 10-digit phone number' })
  phoneNo?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  branchName?: string;
}
