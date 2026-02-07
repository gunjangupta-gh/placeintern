import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import compression from 'compression';
import { randomUUID } from 'crypto';
import { AllExceptionsFilter } from './core/common/filters/all-exceptions.filter';
import { SanitizePipe } from './core/common/pipes/sanitize.pipe';
import { validateProductionEnvironment } from './config/env.validation';

// Prefer BACKEND_PORT so generic PORT (often set by other tools) doesn't hijack backend.
const port = process.env.BACKEND_PORT || process.env.PORT || 8000;

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Validate environment configuration (throws in production if invalid)
  validateProductionEnvironment();

  // Define allowed origins from environment variable
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

  logger.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);

  logger.log('Creating NestJS application...');
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['error', 'warn', 'log', 'debug'],
    bufferLogs: true,
  });

  // Configure WebSocket adapter for Socket.io
  app.useWebSocketAdapter(new IoAdapter(app));
  logger.log('WebSocket adapter (Socket.io) configured');

  // Trust proxy - required to get real client IP behind reverse proxy (nginx, cloudflare, etc.)
  // This allows Express to read X-Forwarded-For and X-Real-IP headers correctly
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);
  logger.log('Trust proxy enabled for correct client IP detection');

  // Enable CORS with specific allowed origins
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'x-institution-id',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
  logger.log(`CORS enabled (${process.env.NODE_ENV === 'production' ? 'restricted' : 'permissive'} mode)`);

  // ===== SECURITY CONFIGURATION =====

  // Request ID middleware - adds unique ID to each request for tracing
  app.use((req: any, res: any, next: any) => {
    const existingId =
      req.headers['x-request-id'] ||
      req.headers['x-correlation-id'] ||
      req.headers['x-trace-id'];
    const requestId = existingId || randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });
  logger.log('Request ID middleware configured');

  // Security middleware - blocks suspicious requests
  app.use((req: any, res: any, next: any) => {
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const blockedAgents = ['sqlmap', 'nikto', 'nmap', 'masscan', 'zgrab', 'gobuster', 'dirbuster'];

    // Block known malicious user agents
    if (blockedAgents.some((agent) => userAgent.includes(agent))) {
      logger.warn(`Blocked suspicious user agent: ${userAgent}`);
      return res.status(403).json({ success: false, statusCode: 403, message: 'Access denied' });
    }

    // Check for path traversal and injection patterns
    const url = req.originalUrl || req.url;
    const suspiciousPatterns = [
      /\.\.\//, // Path traversal
      /<script/i, // XSS in URL
      /union\s+select/i, // SQL injection
    ];

    if (suspiciousPatterns.some((pattern) => pattern.test(url))) {
      logger.warn(`Blocked suspicious URL pattern: ${url}`);
      return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid request' });
    }

    next();
  });
  logger.log('Security middleware configured');

  // Security headers with Helmet (comprehensive configuration)
  app.use(
    helmet({
      // Content Security Policy - enabled in production
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', '*'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", ...(process.env.ALLOWED_ORIGINS?.split(',') || [])],
        },
      } : false,
      // Cross-Origin settings
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Additional protections
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: process.env.NODE_ENV === 'production' ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      } : false,
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    }),
  );
  logger.log('Security headers configured (Helmet)');

  // Body parser limits (protect against large payload attacks)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  logger.log('Body parser configured with 10MB limit');

  // Compression
  app.use(compression());
  logger.log('Response compression enabled');

  // Cookie security settings (for responses that set cookies)
  app.use((req: any, res: any, next: any) => {
    // Override cookie method to enforce security settings
    const originalCookie = res.cookie.bind(res);
    res.cookie = (name: string, value: string, options: any = {}) => {
      const secureOptions = {
        ...options,
        httpOnly: options.httpOnly !== false, // Default to true
        secure: process.env.NODE_ENV === 'production' ? true : options.secure,
        sameSite: options.sameSite || 'strict',
        maxAge: options.maxAge || 24 * 60 * 60 * 1000, // Default 24 hours
      };
      return originalCookie(name, value, secureOptions);
    };
    next();
  });
  logger.log('Cookie security configured');

  // Origin validation for state-changing requests (CSRF-like protection)
  // In production, validates Origin header for POST/PUT/PATCH/DELETE requests
  if (process.env.NODE_ENV === 'production') {
    app.use((req: any, res: any, next: any) => {
      const method = req.method.toUpperCase();
      // Skip safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return next();
      }

      const origin = req.headers['origin'];
      // Skip if no origin (same-origin requests, API tools)
      if (!origin) {
        return next();
      }

      // Validate origin against allowed origins
      if (!allowedOrigins.some((allowed: string) => origin === allowed)) {
        logger.warn(`Blocked request from unauthorized origin: ${origin}`);
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: 'Request origin not allowed',
        });
      }

      next();
    });
    logger.log('Origin validation enabled for state-changing requests');
  }

  // ===== GLOBAL CONFIGURATION =====

  // Set global prefix for all routes
  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/(.*)'], // Exclude health endpoints
  });
  logger.log('Global API prefix set to /api');

  // Global pipes - SanitizePipe for XSS prevention, ValidationPipe for DTO validation
  logger.log('Setting up global pipes...');
  app.useGlobalPipes(
    // Sanitize inputs first (XSS prevention)
    new SanitizePipe(),
    // Then validate DTOs
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        // Disabled for security - use explicit @Type() decorators in DTOs instead
        enableImplicitConversion: false,
      },
    }),
  );
  logger.log('Global pipes configured (SanitizePipe + ValidationPipe)');

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());
  logger.log('Global exception filter configured');

  // ===== SWAGGER DOCUMENTATION =====

  // Only enable Swagger in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CMS API')
      .setDescription('College Management System API Documentation')
      .setVersion('2.0')
      .addBearerAuth()
      .addTag('Authentication', 'User authentication and authorization')
      .addTag('Students', 'Student management endpoints')
      .addTag('Faculty', 'Faculty management endpoints')
      .addTag('Internships', 'Internship management endpoints')
      .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, swaggerDocument);
    logger.log('Swagger documentation enabled at /api/docs');
  } else {
    logger.log('Swagger documentation disabled in production');
  }

  // ===== GRACEFUL SHUTDOWN =====

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();
  logger.log('Graceful shutdown hooks enabled');

  // ===== GRACEFUL SHUTDOWN HANDLERS =====

  // Graceful shutdown handlers for SIGTERM (Docker/Kubernetes) and SIGINT (Ctrl+C)
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, starting graceful shutdown...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received, starting graceful shutdown...');
    await app.close();
    process.exit(0);
  });

  // ===== START SERVER =====

  logger.log(`Starting server on port ${port}...`);
  await app.listen(port, '0.0.0.0');

  // Signal PM2 (when using wait_ready: true) that the app is ready to accept connections.
  // This prevents PM2 from considering the process still launching and reporting it unhealthy.
  if (typeof process !== 'undefined' && typeof process.send === 'function') {
    process.send('ready');
    logger.log('PM2 readiness signal sent');
  }

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`Server is ready to accept connections`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  // Ensure the real stack is visible even if Nest logs are buffered
  if (error?.code === 'EADDRINUSE') {
    logger.error(
      `Failed to start application: port ${port} is already in use. ` +
        `Set BACKEND_PORT to a free port or stop the process using ${port}.`,
    );
  } else {
    logger.error('Failed to start application', error?.stack ?? String(error));
  }
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
