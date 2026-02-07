import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';

interface MailJob {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

// Template cache with compiled Handlebars templates
interface CachedTemplate {
  compiled: handlebars.TemplateDelegate;
  cachedAt: number;
}

// Cache configuration
const TEMPLATE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 50; // Maximum number of cached templates
const CACHE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Valid template name pattern (alphanumeric, hyphens, underscores only)
const VALID_TEMPLATE_NAME = /^[a-zA-Z0-9_-]+$/;

@Processor('mail')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);
  private transporter: nodemailer.Transporter;
  private readonly templateCache = new Map<string, CachedTemplate>();
  private readonly templatesDir: string;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private configService: ConfigService) {
    super();
    this.templatesDir = path.join(__dirname, 'templates');
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('MAIL_HOST'),
      port: this.configService.get('MAIL_PORT'),
      secure: this.configService.get('MAIL_SECURE', false),
      auth: {
        user: this.configService.get('MAIL_USER'),
        pass: this.configService.get('MAIL_PASSWORD'),
      },
    });

    // Start periodic cache cleanup
    this.startCacheCleanup();
  }

  /**
   * Start periodic cleanup of expired cache entries
   */
  private startCacheCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, CACHE_CLEANUP_INTERVAL_MS);

    // Ensure cleanup doesn't prevent process exit
    this.cleanupInterval.unref();
  }

  /**
   * Remove expired entries from cache
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.templateCache.entries()) {
      if (now - entry.cachedAt >= TEMPLATE_CACHE_TTL_MS) {
        this.templateCache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug(`Cleaned up ${removed} expired template cache entries`);
    }
  }

  /**
   * Validate template name to prevent path traversal attacks
   */
  private validateTemplateName(templateName: string): void {
    if (!templateName || typeof templateName !== 'string') {
      throw new Error('Template name is required');
    }

    if (!VALID_TEMPLATE_NAME.test(templateName)) {
      throw new Error(`Invalid template name: ${templateName}. Only alphanumeric characters, hyphens, and underscores are allowed.`);
    }

    if (templateName.length > 100) {
      throw new Error('Template name is too long');
    }
  }

  /**
   * Evict oldest entries if cache is full
   */
  private evictOldestIfNeeded(): void {
    if (this.templateCache.size < MAX_CACHE_SIZE) {
      return;
    }

    // Find and remove the oldest entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.templateCache.entries()) {
      if (entry.cachedAt < oldestTime) {
        oldestTime = entry.cachedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.templateCache.delete(oldestKey);
      this.logger.debug(`Evicted oldest template '${oldestKey}' from cache (size limit reached)`);
    }
  }

  /**
   * Get compiled template from cache or load asynchronously
   */
  private async getCompiledTemplate(templateName: string): Promise<handlebars.TemplateDelegate> {
    // Validate template name first
    this.validateTemplateName(templateName);

    const now = Date.now();
    const cached = this.templateCache.get(templateName);

    // Return cached template if still valid
    if (cached && (now - cached.cachedAt) < TEMPLATE_CACHE_TTL_MS) {
      return cached.compiled;
    }

    // Load template asynchronously
    const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);

    let templateContent: string;
    try {
      templateContent = await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Email template '${templateName}' not found`);
      }
      throw new Error(`Failed to read email template '${templateName}': ${(error as Error).message}`);
    }

    const compiled = handlebars.compile(templateContent);

    // Evict oldest entry if cache is full
    this.evictOldestIfNeeded();

    // Cache the compiled template
    this.templateCache.set(templateName, {
      compiled,
      cachedAt: now,
    });

    this.logger.debug(`Template '${templateName}' loaded and cached (cache size: ${this.templateCache.size})`);
    return compiled;
  }

  async process(job: Job<MailJob>): Promise<void> {
    this.logger.log(`Processing mail job ${job.id} for ${job.data.to}`);

    try {
      const { to, subject, template, context } = job.data;

      // Validate required fields
      if (!to || !subject || !template) {
        throw new Error('Missing required fields: to, subject, or template');
      }

      // Get compiled template (from cache or load async)
      const compiledTemplate = await this.getCompiledTemplate(template);
      const html = compiledTemplate(context || {});

      await this.transporter.sendMail({
        from: this.configService.get('MAIL_FROM'),
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to process mail job ${job.id}`, error.stack);
      throw error;
    }
  }

  /**
   * Cleanup on worker close
   */
  @OnWorkerEvent('closed')
  onClosed(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.templateCache.clear();
    this.logger.debug('Mail processor cleanup completed');
  }
}
