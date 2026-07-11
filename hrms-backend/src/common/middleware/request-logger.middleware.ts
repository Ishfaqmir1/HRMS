import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Structured request logger.
 *
 * Logs every request with:
 * - Request ID (from middleware)
 * - HTTP method + URL
 * - Status code
 * - Response time (ms)
 * - User ID + Company ID (if authenticated)
 * - IP + User-Agent
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl } = req;
    const requestId = req['requestId'] || '-';
    const ip = req.ip || req.socket?.remoteAddress || '-';
    const ua = (req.headers['user-agent'] || '-').slice(0, 120);

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      const user = req.user as any;
      const userId = user?.userId || '-';
      const companyId = user?.companyId || '-';

      const logLine = [
        `[${requestId}]`,
        `${method} ${originalUrl}`,
        `→ ${statusCode}`,
        `${duration}ms`,
        `user=${userId}`,
        `company=${companyId}`,
        `ip=${ip}`,
      ].join(' ');

      if (statusCode >= 500) {
        this.logger.error(logLine);
      } else if (statusCode >= 400) {
        this.logger.warn(logLine);
      } else {
        this.logger.log(logLine);
      }
    });

    next();
  }
}
