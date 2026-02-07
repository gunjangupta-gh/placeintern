import { IsString, IsOptional, IsArray, IsEnum, IsBoolean, MinLength, MaxLength, IsObject } from 'class-validator';
import { Role } from '../../../generated/prisma/client';

/**
 * Target types for sending notifications
 */
export enum NotificationTarget {
  USER = 'user',              // Single user by ID
  USERS = 'users',            // Multiple users by IDs
  ROLE = 'role',              // All users with a specific role
  INSTITUTION = 'institution', // All users in an institution
  MY_STUDENTS = 'my_students', // Faculty: assigned students only
  BROADCAST = 'broadcast',     // All users (State/Admin only)
}

/**
 * DTO for sending notifications
 */
export class SendNotificationDto {
  @IsEnum(NotificationTarget)
  target: NotificationTarget;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  body: string;

  @IsOptional()
  @IsString()
  userId?: string; // For single user target

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[]; // For multiple users target

  @IsOptional()
  @IsEnum(Role)
  role?: Role; // For role target

  @IsOptional()
  @IsString()
  institutionId?: string; // For institution target (Principals use their own)

  @IsOptional()
  @IsArray()
  @IsEnum(Role, { each: true })
  roleFilter?: Role[]; // Filter by roles within institution

  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>; // Additional data payload
}

/**
 * DTO for faculty to send reminder to students
 */
export class SendStudentReminderDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  body: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentIds?: string[]; // Specific students, or all assigned if empty

  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}

/**
 * DTO for principal to send announcement to institution
 */
export class SendInstitutionAnnouncementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  body: string;

  @IsOptional()
  @IsArray()
  @IsEnum(Role, { each: true })
  targetRoles?: Role[]; // Filter by specific roles, or all if empty

  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}

/**
 * DTO for state/admin to send system-wide announcement
 */
export class SendSystemAnnouncementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  body: string;

  @IsOptional()
  @IsArray()
  @IsEnum(Role, { each: true })
  targetRoles?: Role[]; // Filter by specific roles, or all if empty

  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  force?: boolean; // Bypass user notification settings

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
