import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Security Middleware
 * - Validates request headers
 * - Blocks suspicious requests
 * - Adds security-related request metadata
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  // Blocked user agents (commonly used by malicious bots)
  private readonly blockedUserAgents = [
    'sqlmap',
    'nikto',
    'nmap',
    'masscan',
    'zgrab',
    'gobuster',
    'dirbuster',
  ];

  // Suspicious patterns in request paths
  private readonly suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /<script/i, // XSS in URL
    /union\s+select/i, // SQL injection
    /\bor\b.*=.*\bor\b/i, // SQL injection
    /\bexec\s*\(/i, // Command injection
    /\beval\s*\(/i, // Code injection
  ];

  use(req: Request, res: Response, next: NextFunction) {
    // Get user agent
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();

    // Block known malicious user agents
    if (this.blockedUserAgents.some((agent) => userAgent.includes(agent))) {
      this.logger.warn(
        `Blocked request from suspicious user agent: ${userAgent} - IP: ${this.getClientIp(req)}`,
      );
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: 'Access denied',
      });
    }

    // Check for suspicious patterns in URL
    const fullUrl = req.originalUrl || req.url;
    if (this.suspiciousPatterns.some((pattern) => pattern.test(fullUrl))) {
      this.logger.warn(
        `Blocked request with suspicious pattern in URL: ${fullUrl} - IP: ${this.getClientIp(req)}`,
      );
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Invalid request',
      });
    }

    // Check for excessively large headers (potential attack)
    const headerSize = JSON.stringify(req.headers).length;
    if (headerSize > 16384) {
      // 16KB header limit
      this.logger.warn(
        `Blocked request with oversized headers (${headerSize} bytes) - IP: ${this.getClientIp(req)}`,
      );
      return res.status(431).json({
        success: false,
        statusCode: 431,
        message: 'Request header fields too large',
      });
    }

    // Add security metadata to request
    (req as any).securityChecked = true;
    (req as any).clientIp = this.getClientIp(req);

    next();
  }

  /**
   * Get client IP address considering proxies
   */
  private getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = (forwardedFor as string).split(',').map((ip) => ip.trim());
      return ips[0];
    }
    return (
      (req.headers['x-real-ip'] as string) ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }
}
