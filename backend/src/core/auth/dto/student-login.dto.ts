import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class StudentLoginDto {
  @IsNotEmpty()
  @IsString()
  rollNumber: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  password: string;
}
