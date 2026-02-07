import { Logger } from '@nestjs/common';

/**
 * Environment Variable Validation
 * Validates required secrets and configuration on application startup
 */

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_PRODUCTION_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'ALLOWED_ORIGINS',
  'CORS_ORIGIN',
];

const RECOMMENDED_PRODUCTION_VARS = [
  'REDIS_URL',
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
];

const WEAK_SECRETS = [
  'your_super_secret_jwt_key',
  'your_super_secret_jwt_key_CHANGE_THIS_IN_PRODUCTION',
  'change-this-secret-in-production',
  'changeme',
  'secret',
  'password',
  'admin123',
  'Admin@1234',
];

export function validateEnvironment(): ValidationResult {
  const logger = new Logger('ConfigValidation');
  const isProduction = process.env.NODE_ENV === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables in production
  if (isProduction) {
    for (const varName of REQUIRED_PRODUCTION_VARS) {
      if (!process.env[varName]) {
        errors.push(`Missing required environment variable: ${varName}`);
      }
    }

    // Check recommended variables
    for (const varName of RECOMMENDED_PRODUCTION_VARS) {
      if (!process.env[varName]) {
        warnings.push(`Missing recommended environment variable: ${varName}`);
      }
    }
  }

  // Validate JWT_SECRET strength
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) {
    if (WEAK_SECRETS.some(weak => jwtSecret.toLowerCase().includes(weak.toLowerCase()))) {
      if (isProduction) {
        errors.push('JWT_SECRET contains a weak/default value. Generate a strong secret with: openssl rand -base64 32');
      } else {
        warnings.push('JWT_SECRET contains a weak/default value (acceptable for development)');
      }
    }
    if (jwtSecret.length < 32) {
      if (isProduction) {
        errors.push(`JWT_SECRET is too short (${jwtSecret.length} chars). Minimum 32 characters required.`);
      } else {
        warnings.push(`JWT_SECRET is short (${jwtSecret.length} chars). Recommended: 32+ characters.`);
      }
    }
  }

  // Validate MongoDB password in production
  const databaseUrl = process.env.DATABASE_URL || '';
  if (isProduction && databaseUrl) {
    const passwordMatch = databaseUrl.match(/:([^:@]+)@/);
    if (passwordMatch) {
      const password = passwordMatch[1];
      if (WEAK_SECRETS.some(weak => password.toLowerCase() === weak.toLowerCase())) {
        errors.push('DATABASE_URL contains a weak/default password. Use a strong, generated password.');
      }
    }
  }

  // Log results
  if (errors.length > 0) {
    logger.error('='.repeat(60));
    logger.error('CONFIGURATION VALIDATION FAILED');
    logger.error('='.repeat(60));
    errors.forEach(err => logger.error(`  - ${err}`));
    logger.error('='.repeat(60));
  }

  if (warnings.length > 0) {
    logger.warn('Configuration warnings:');
    warnings.forEach(warn => logger.warn(`  - ${warn}`));
  }

  if (errors.length === 0 && warnings.length === 0) {
    logger.log('Environment configuration validated successfully');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates environment and throws if invalid in production
 */
export function validateProductionEnvironment(): void {
  const result = validateEnvironment();

  if (!result.isValid && process.env.NODE_ENV === 'production') {
    throw new Error(
      `Production environment validation failed:\n${result.errors.join('\n')}`
    );
  }
}
