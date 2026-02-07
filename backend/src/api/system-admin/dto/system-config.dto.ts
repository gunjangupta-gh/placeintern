import { IsString, IsOptional, IsBoolean, IsObject, IsArray } from 'class-validator';

export class UpdateSystemConfigDto {
  @IsOptional()
  @IsObject()
  general?: {
    siteName?: string;
    maintenanceMessage?: string;
    supportEmail?: string;
  };

  @IsOptional()
  @IsObject()
  security?: {
    sessionTimeout?: number;
    maxLoginAttempts?: number;
    passwordMinLength?: number;
    requirePasswordChange?: boolean;
  };

  @IsOptional()
  @IsObject()
  features?: {
    enableRegistration?: boolean;
    enableGoogleAuth?: boolean;
    enableNotifications?: boolean;
    enableFileUploads?: boolean;
  };

  @IsOptional()
  @IsObject()
  notifications?: {
    emailEnabled?: boolean;
    smsEnabled?: boolean;
    pushEnabled?: boolean;
  };
}

export class MaintenanceModeDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];
}

export class SystemConfigResponseDto {
  general: {
    siteName: string;
    maintenanceMessage: string;
    supportEmail: string;
    version: string;
  };
  security: {
    sessionTimeout: number;
    maxLoginAttempts: number;
    passwordMinLength: number;
    requirePasswordChange: boolean;
  };
  features: {
    enableRegistration: boolean;
    enableGoogleAuth: boolean;
    enableNotifications: boolean;
    enableFileUploads: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
  };
  maintenance: {
    enabled: boolean;
    message: string;
    allowedIps: string[];
  };
}
