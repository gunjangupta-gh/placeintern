import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { WebSocketService } from '../../../infrastructure/websocket/websocket.service';
import { AdminChannel } from '../../../infrastructure/websocket/dto';
import { AuditAction, AuditCategory, AuditSeverity, Role } from '../../../generated/prisma/client';

export enum ConfigCategory {
  GENERAL = 'general',
  SECURITY = 'security',
  FEATURES = 'features',
  NOTIFICATIONS = 'notifications',
  MAINTENANCE = 'maintenance',
  INTEGRATIONS = 'integrations',
}

export interface SystemConfigItem {
  key: string;
  value: any;
  category: ConfigCategory;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
}

// Default system configurations
const DEFAULT_CONFIGS: SystemConfigItem[] = [
  // General Settings
  {
    key: 'app.name',
    value: 'CMS Platform',
    category: ConfigCategory.GENERAL,
    description: 'Application name displayed across the platform',
    type: 'string',
    defaultValue: 'CMS Platform',
  },
  {
    key: 'app.timezone',
    value: 'Asia/Kolkata',
    category: ConfigCategory.GENERAL,
    description: 'Default timezone for the application',
    type: 'string',
    defaultValue: 'Asia/Kolkata',
  },
  {
    key: 'app.dateFormat',
    value: 'DD/MM/YYYY',
    category: ConfigCategory.GENERAL,
    description: 'Default date format',
    type: 'string',
    defaultValue: 'DD/MM/YYYY',
    validation: { options: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] },
  },

  // Security Settings
  {
    key: 'security.sessionTimeout',
    value: 30,
    category: ConfigCategory.SECURITY,
    description: 'Session timeout in minutes',
    type: 'number',
    defaultValue: 30,
    validation: { min: 5, max: 480 },
  },
  {
    key: 'security.maxLoginAttempts',
    value: 5,
    category: ConfigCategory.SECURITY,
    description: 'Maximum failed login attempts before account lockout',
    type: 'number',
    defaultValue: 5,
    validation: { min: 3, max: 10 },
  },
  {
    key: 'security.lockoutDuration',
    value: 15,
    category: ConfigCategory.SECURITY,
    description: 'Account lockout duration in minutes',
    type: 'number',
    defaultValue: 15,
    validation: { min: 5, max: 60 },
  },
  {
    key: 'security.passwordMinLength',
    value: 8,
    category: ConfigCategory.SECURITY,
    description: 'Minimum password length',
    type: 'number',
    defaultValue: 8,
    validation: { min: 6, max: 32 },
  },
  {
    key: 'security.requirePasswordChange',
    value: 90,
    category: ConfigCategory.SECURITY,
    description: 'Days until password change is required (0 to disable)',
    type: 'number',
    defaultValue: 90,
    validation: { min: 0, max: 365 },
  },
  {
    key: 'security.twoFactorEnabled',
    value: false,
    category: ConfigCategory.SECURITY,
    description: 'Enable two-factor authentication',
    type: 'boolean',
    defaultValue: false,
  },

  // Internship Settings
  {
    key: 'internship.minimumStartDate',
    value: '2026-01-10',
    category: ConfigCategory.GENERAL,
    description: 'Minimum allowed internship start date (YYYY-MM-DD format). Internships cannot start before this date.',
    type: 'string',
    defaultValue: '2026-01-10',
  },

  // Feature Flags
  {
    key: 'features.selfRegistration',
    value: false,
    category: ConfigCategory.FEATURES,
    description: 'Allow users to self-register',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'features.bulkUpload',
    value: true,
    category: ConfigCategory.FEATURES,
    description: 'Enable bulk upload functionality',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'features.reportGeneration',
    value: true,
    category: ConfigCategory.FEATURES,
    description: 'Enable report generation',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'features.emailNotifications',
    value: true,
    category: ConfigCategory.FEATURES,
    description: 'Enable email notifications',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'features.maintenanceMode',
    value: false,
    category: ConfigCategory.FEATURES,
    description: 'Enable maintenance mode (blocks non-admin access)',
    type: 'boolean',
    defaultValue: false,
  },

  // Notification Settings
  {
    key: 'notifications.emailFromName',
    value: 'CMS Platform',
    category: ConfigCategory.NOTIFICATIONS,
    description: 'Email sender name',
    type: 'string',
    defaultValue: 'CMS Platform',
  },
  {
    key: 'notifications.digestEnabled',
    value: true,
    category: ConfigCategory.NOTIFICATIONS,
    description: 'Enable daily digest emails',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'notifications.digestTime',
    value: '09:00',
    category: ConfigCategory.NOTIFICATIONS,
    description: 'Time to send daily digest (24-hour format)',
    type: 'string',
    defaultValue: '09:00',
  },

  // Maintenance Settings
  {
    key: 'maintenance.autoBackupEnabled',
    value: true,
    category: ConfigCategory.MAINTENANCE,
    description: 'Enable automatic daily backups',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'maintenance.backupRetentionDays',
    value: 30,
    category: ConfigCategory.MAINTENANCE,
    description: 'Number of days to retain backups',
    type: 'number',
    defaultValue: 30,
    validation: { min: 7, max: 365 },
  },
  {
    key: 'maintenance.logRetentionDays',
    value: 90,
    category: ConfigCategory.MAINTENANCE,
    description: 'Number of days to retain audit logs',
    type: 'number',
    defaultValue: 90,
    validation: { min: 30, max: 365 },
  },
];

@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);
  private configCache: Map<string, any> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly wsService: WebSocketService,
  ) {
    this.initializeCache();
  }

  /**
   * Initialize config cache from database
   */
  private async initializeCache() {
    try {
      const configs = await this.prisma.systemConfig.findMany();
      for (const config of configs) {
        this.configCache.set(config.key, config.value);
      }
      this.logger.log(`Loaded ${configs.length} configurations into cache`);
    } catch (error) {
      this.logger.warn('Could not load configurations, will use defaults');
    }
  }

  /**
   * Clear and reload config cache from database
   */
  async refreshCache(): Promise<void> {
    this.configCache.clear();
    await this.initializeCache();
  }

  /**
   * Get a configuration value
   */
  async get<T = any>(key: string): Promise<T> {
    // Check cache first
    if (this.configCache.has(key)) {
      return this.configCache.get(key) as T;
    }

    // Check database
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });

    if (config) {
      this.configCache.set(key, config.value);
      return config.value as T;
    }

    // Return default value
    const defaultConfig = DEFAULT_CONFIGS.find(c => c.key === key);
    if (defaultConfig) {
      return defaultConfig.defaultValue as T;
    }

    return undefined as T;
  }

  /**
   * Set a configuration value
   */
  async set(
    key: string,
    value: any,
    userId: string,
    userRole: Role,
  ) {
    const configDef = DEFAULT_CONFIGS.find(c => c.key === key);

    // Validate value
    if (configDef) {
      this.validateValue(configDef, value);
    }

    const existing = await this.prisma.systemConfig.findUnique({
      where: { key },
    });

    const oldValue = existing?.value;
    const category = configDef?.category || ConfigCategory.GENERAL;

    const config = await this.prisma.systemConfig.upsert({
      where: { key },
      update: {
        value,
        updatedBy: userId,
      },
      create: {
        key,
        value,
        category,
        updatedBy: userId,
      },
    });

    // Update cache
    this.configCache.set(key, value);

    // Broadcast config change to admins
    this.wsService.sendToAdminChannel(AdminChannel.METRICS, 'configChange', {
      key,
      value,
      oldValue,
      changedBy: userId,
      timestamp: new Date(),
    });

    // Audit log
    await this.auditService.log({
      action: AuditAction.CONFIGURATION_CHANGE,
      entityType: 'SystemConfig',
      entityId: key,
      userId,
      userRole,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.HIGH,
      description: `Configuration changed: ${key}`,
      oldValues: { value: oldValue },
      newValues: { value },
    });

    return config;
  }

  /**
   * Get all configurations by category
   */
  async getByCategory(category?: ConfigCategory) {
    const dbConfigs = await this.prisma.systemConfig.findMany({
      where: category ? { category } : undefined,
      orderBy: { key: 'asc' },
    });

    // Merge with defaults
    const result: Record<string, any>[] = [];
    const dbConfigMap = new Map(dbConfigs.map(c => [c.key, c]));

    for (const defaultConfig of DEFAULT_CONFIGS) {
      if (category && defaultConfig.category !== category) continue;

      const dbConfig = dbConfigMap.get(defaultConfig.key);
      result.push({
        key: defaultConfig.key,
        value: dbConfig?.value ?? defaultConfig.value,
        category: defaultConfig.category,
        description: defaultConfig.description,
        type: defaultConfig.type,
        defaultValue: defaultConfig.defaultValue,
        validation: defaultConfig.validation,
        isDefault: !dbConfig,
        updatedAt: dbConfig?.updatedAt,
        updatedBy: dbConfig?.updatedBy,
      });
    }

    // Add any custom configs from database not in defaults
    for (const dbConfig of dbConfigs) {
      if (!DEFAULT_CONFIGS.find(d => d.key === dbConfig.key)) {
        result.push({
          key: dbConfig.key,
          value: dbConfig.value,
          category: dbConfig.category,
          type: 'json',
          isDefault: false,
          isCustom: true,
          updatedAt: dbConfig.updatedAt,
          updatedBy: dbConfig.updatedBy,
        });
      }
    }

    return result;
  }

  /**
   * Get all configurations grouped by category
   */
  async getAllGrouped() {
    const configs = await this.getByCategory();
    const grouped: Record<string, any[]> = {};

    for (const config of configs) {
      if (!grouped[config.category]) {
        grouped[config.category] = [];
      }
      grouped[config.category].push(config);
    }

    return grouped;
  }

  /**
   * Bulk update configurations
   */
  async bulkUpdate(
    updates: { key: string; value: any }[],
    userId: string,
    userRole: Role,
  ) {
    const results: { key: string; success: boolean; error?: string }[] = [];

    for (const update of updates) {
      try {
        await this.set(update.key, update.value, userId, userRole);
        results.push({ key: update.key, success: true });
      } catch (error) {
        results.push({ key: update.key, success: false, error: error.message });
      }
    }

    return {
      success: results.every(r => r.success),
      results,
      message: `Updated ${results.filter(r => r.success).length} of ${results.length} configurations`,
    };
  }

  /**
   * Reset a configuration to its default value
   */
  async resetToDefault(key: string, userId: string, userRole: Role) {
    const defaultConfig = DEFAULT_CONFIGS.find(c => c.key === key);
    if (!defaultConfig) {
      throw new NotFoundException(`Configuration ${key} not found`);
    }

    const existing = await this.prisma.systemConfig.findUnique({
      where: { key },
    });

    if (existing) {
      await this.prisma.systemConfig.delete({
        where: { key },
      });
    }

    // Update cache with default value
    this.configCache.set(key, defaultConfig.defaultValue);

    // Audit log
    await this.auditService.log({
      action: AuditAction.CONFIGURATION_CHANGE,
      entityType: 'SystemConfig',
      entityId: key,
      userId,
      userRole,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.MEDIUM,
      description: `Configuration reset to default: ${key}`,
      oldValues: { value: existing?.value },
      newValues: { value: defaultConfig.defaultValue },
    });

    return {
      success: true,
      key,
      value: defaultConfig.defaultValue,
      message: 'Configuration reset to default',
    };
  }

  /**
   * Reset all configurations to defaults
   */
  async resetAllToDefaults(userId: string, userRole: Role) {
    await this.prisma.systemConfig.deleteMany({});

    // Clear cache and reload with defaults
    this.configCache.clear();
    for (const config of DEFAULT_CONFIGS) {
      this.configCache.set(config.key, config.defaultValue);
    }

    // Audit log
    await this.auditService.log({
      action: AuditAction.CONFIGURATION_CHANGE,
      entityType: 'SystemConfig',
      entityId: 'all',
      userId,
      userRole,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.CRITICAL,
      description: 'All configurations reset to defaults',
    });

    return {
      success: true,
      message: 'All configurations reset to defaults',
    };
  }

  /**
   * Export all configurations
   */
  async exportConfigs() {
    const configs = await this.getByCategory();
    return {
      exportedAt: new Date(),
      version: '1.0',
      configs: configs.map(c => ({
        key: c.key,
        value: c.value,
        category: c.category,
      })),
    };
  }

  /**
   * Import configurations from export
   */
  async importConfigs(
    data: { configs: { key: string; value: any; category: string }[] },
    userId: string,
    userRole: Role,
  ) {
    const results = await this.bulkUpdate(
      data.configs.map(c => ({ key: c.key, value: c.value })),
      userId,
      userRole,
    );

    // Audit log
    await this.auditService.log({
      action: AuditAction.CONFIGURATION_CHANGE,
      entityType: 'SystemConfig',
      entityId: 'import',
      userId,
      userRole,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.HIGH,
      description: `Imported ${results.results.filter(r => r.success).length} configurations`,
    });

    return results;
  }

  /**
   * Validate a configuration value against its definition
   */
  private validateValue(config: SystemConfigItem, value: any) {
    const { type, validation } = config;

    // Type validation
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new BadRequestException(`${config.key} must be a string`);
        }
        break;
      case 'number':
        if (typeof value !== 'number') {
          throw new BadRequestException(`${config.key} must be a number`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new BadRequestException(`${config.key} must be a boolean`);
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          throw new BadRequestException(`${config.key} must be an array`);
        }
        break;
    }

    // Additional validation rules
    if (validation) {
      if (typeof value === 'number') {
        if (validation.min !== undefined && value < validation.min) {
          throw new BadRequestException(`${config.key} must be at least ${validation.min}`);
        }
        if (validation.max !== undefined && value > validation.max) {
          throw new BadRequestException(`${config.key} must be at most ${validation.max}`);
        }
      }

      if (typeof value === 'string' && validation.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          throw new BadRequestException(`${config.key} has invalid format`);
        }
      }

      if (validation.options && !validation.options.includes(value)) {
        throw new BadRequestException(
          `${config.key} must be one of: ${validation.options.join(', ')}`,
        );
      }
    }
  }

  /**
   * Check if a feature is enabled
   */
  async isFeatureEnabled(featureKey: string): Promise<boolean> {
    const key = featureKey.startsWith('features.') ? featureKey : `features.${featureKey}`;
    return this.get<boolean>(key);
  }

  /**
   * Check if maintenance mode is enabled
   */
  async isMaintenanceMode(): Promise<boolean> {
    return this.get<boolean>('features.maintenanceMode');
  }
}
