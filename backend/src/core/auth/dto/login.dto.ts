import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  // Some clients include a selected portal role during login.
  // Authentication is still based on email/password; role is ignored server-side.
  @IsOptional()
  @IsString()
  role?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
