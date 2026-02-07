import { IsString, IsNotEmpty, Length, IsUUID } from 'class-validator';

export class MfaLoginDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 8) // TOTP is 6 digits, backup codes are 8 chars
  code: string;
}
