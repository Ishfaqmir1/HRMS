import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Maps Prisma error codes to user-friendly messages.
 */
const PRISMA_ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  P2000: { status: 400, message: 'The provided value for a column is too long.' },
  P2001: { status: 404, message: 'The requested record does not exist.' },
  P2002: { status: 409, message: 'A record with this value already exists.' },
  P2003: { status: 409, message: 'This operation references data that does not exist.' },
  P2004: { status: 409, message: 'A constraint failed on the database.' },
  P2005: { status: 400, message: 'The value stored is invalid for the field type.' },
  P2011: { status: 400, message: 'Null constraint violation on the database.' },
  P2014: { status: 409, message: 'The change you are trying to make would violate a required relation.' },
  P2016: { status: 400, message: 'Query interpretation error.' },
  P2025: { status: 404, message: 'The requested record was not found.' },
};

/**
 * Global exception filter that:
 * 1. Passes NestJS HttpExceptions through as-is (preserving our ConflictException messages)
 * 2. Maps Prisma errors to user-friendly messages
 * 3. Logs 500+ errors with stack traces
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'An unexpected error occurred.';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      // Pass through our own HTTP exceptions (ConflictException, BadRequestException, etc.)
      // with their original messages intact.
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        error = exception.name;
      } else if (typeof res === 'object' && res !== null) {
        message = (res as any).message || message;
        error = (res as any).error || exception.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapping = PRISMA_ERROR_MESSAGES[exception.code];
      if (mapping) {
        status = mapping.status;
        message = mapping.message;
        error = 'Database Error';

        // For P2002 (unique constraint), append the target field names for clarity
        if (exception.code === 'P2002' && exception.meta?.target) {
          const fields = (exception.meta.target as string[]).join(', ');
          message = `A record with this ${fields} already exists.`;
        }
      } else {
        // Unknown Prisma error code
        status = 500;
        message = 'A database error occurred. Please try again.';
        error = 'Database Error';
        this.logger.error(
          `Unhandled Prisma error code: ${exception.code}`,
          exception.stack,
        );
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = 400;
      message = 'Invalid data provided to the database.';
      error = 'Validation Error';
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
