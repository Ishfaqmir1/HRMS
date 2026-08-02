import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';

/**
 * Validates that all critical environment variables are set before the
 * application starts. Hard-fails with a descriptive message so the issue
 * cannot be missed in any environment.
 *
 * This prevents the common production mistake of deploying with default
 * or empty secrets, which would otherwise silently expose the platform.
 */
function validateEnv(config: ConfigService): void {
  const requiredVars: { key: string; name: string; hint: string }[] = [
    {
      key: 'jwt.accessSecret',
      name: 'JWT_ACCESS_SECRET',
      hint: 'Generate a strong secret: openssl rand -base64 32',
    },
    {
      key: 'jwt.refreshSecret',
      name: 'JWT_REFRESH_SECRET',
      hint: 'Use a different secret than JWT_ACCESS_SECRET',
    },
  ];

  const missing: string[] = [];

  for (const { key, name, hint } of requiredVars) {
    const value = config.get<string>(key);
    if (!value || value.length < 16) {
      missing.push(`  • ${name} — ${hint}`);
    }
  }

  if (missing.length > 0) {
    const message = [
      '\n═══════════════════════════════════════════════════════════════',
      '  ❌ CRITICAL SECURITY CONFIGURATION ERROR',
      '═══════════════════════════════════════════════════════════════',
      '',
      '  The following environment variables are missing or too short',
      '  (minimum 16 characters). The application WILL NOT START.',
      '',
      ...missing,
      '',
      '  Set them in your .env file or environment:',
      '',
      '  # Example .env:',
      '  JWT_ACCESS_SECRET=$(openssl rand -base64 32)',
      '  JWT_REFRESH_SECRET=$(openssl rand -base64 32)',
      '  DATABASE_URL=postgresql://user:pass@localhost:5432/hrms',
      '',
      '═══════════════════════════════════════════════════════════════\n',
    ].join('\n');

    console.error(message);
    process.exit(1);
  }

  console.log('✅  JWT secrets validated — environment is secure.');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: false,
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  const config = app.get(ConfigService);

  // ─── Validate critical env vars before anything else ──────────────
  validateEnv(config);

  // ─── Security Headers (Helmet) ───────────────────────────────────────
  const hstsMaxAge = config.get<number>('security.hstsMaxAge')!;
  const cspDirectives = config.get<string>('security.cspDirectives')!;

  app.use(
    helmet({
      // HTTP Strict Transport Security (HSTS)
      hsts: {
        maxAge: hstsMaxAge,
        includeSubDomains: config.get<boolean>('security.hstsIncludeSubDomains')!,
        preload: true,
      },
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
      // Referrer Policy
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
      // X-Frame-Options, X-Content-Type-Options, etc.
      frameguard: { action: 'deny' },
      noSniff: true,
      xssFilter: true,
      hidePoweredBy: true,
      ieNoOpen: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    }),
  );

  app.use(compression());
  app.use(cookieParser());

  // ─── Serve Static Files ────────────────────────────────────────────────
  const storagePath = path.join(process.cwd(), 'storage', 'documents');
  const uploadsPath = path.join(process.cwd(), 'storage', 'uploads');
  app.use('/storage/documents', express.static(storagePath));
  app.use('/storage/uploads', express.static(uploadsPath));

  app.enableCors({
    origin: config.get<string>('corsOrigin'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
  });

  app.setGlobalPrefix(config.get<string>('apiPrefix')!);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips properties not in the DTO
      forbidNonWhitelisted: false, // allows extra query params like ?status= on list endpoints
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HRMS SaaS Platform API')
    .setDescription('Enterprise HRMS SaaS Platform API with multi-tenant architecture, RBAC, payroll, attendance, leave, and more.')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Request-ID', in: 'header', description: 'Optional request tracing ID' })
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('port')!;
  await app.listen(port);
  console.log(`🚀 HRMS API running on http://localhost:${port}/${config.get('apiPrefix')}`);
  console.log(`📘 Swagger docs at http://localhost:${port}/docs`);
}

bootstrap();
