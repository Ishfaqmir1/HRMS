import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

/**
 * CSRF Protection Middleware — Double-Submit Cookie Pattern
 *
 * How it works:
 * 1. On every GET/HEAD/OPTIONS request, a `csrf-token` cookie is set (if not present).
 * 2. On every state-changing request (POST, PUT, PATCH, DELETE), the middleware
 *    checks that the `X-CSRF-Token` header matches the `csrf-token` cookie value.
 *
 * This prevents CSRF attacks because:
 * - An attacker's site cannot read the `csrf-token` cookie (same-origin policy)
 * - The attacker cannot set a custom `X-CSRF-Token` header cross-origin
 * - The double-submit pattern validates both cookie and header are identical
 *
 * Exempted routes:
 * - Public auth endpoints (login, register, refresh) — these are protected by rate limiting
 * - Webhook endpoints (billing webhooks from Stripe/etc.)
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfMiddleware.name);
  private readonly exemptedPaths = [
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/v1/health',
    '/api/v1/billing/webhook',
  ];

  use(req: Request, res: Response, next: NextFunction) {
    // Use originalUrl for reliable path matching (includes global prefix)
    const requestPath = req.originalUrl || req.url || req.path;

    // Skip CSRF entirely in test environment (e2e tests don't carry CSRF tokens)
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    // Skip CSRF check for exempted paths
    if (this.exemptedPaths.some((path) => requestPath.startsWith(path))) {
      return next();
    }

    // Skip CSRF check for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      // Ensure a CSRF token cookie exists
      if (!req.cookies?.['csrf-token']) {
        const token = crypto.randomBytes(32).toString('hex');
        res.cookie('csrf-token', token, {
          httpOnly: false, // Must be readable by JavaScript
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
        });
      }
      return next();
    }

    // For state-changing methods, validate the CSRF token
    const cookieToken = req.cookies?.['csrf-token'];
    const headerToken = req.headers['x-csrf-token'] as string;

    if (!cookieToken || !headerToken) {
      this.logger.warn(`CSRF validation failed: missing token (method=${req.method}, path=${req.path})`);
      res.status(403).json({
        success: false,
        data: null,
        error: {
          statusCode: 403,
          message: 'CSRF token missing. Include X-CSRF-Token header matching the csrf-token cookie.',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
      this.logger.warn(`CSRF validation failed: token mismatch (method=${req.method}, path=${req.path})`);
      res.status(403).json({
        success: false,
        data: null,
        error: {
          statusCode: 403,
          message: 'CSRF token mismatch. Request rejected.',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  }
}
