import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Request, Response } from 'express';
import { Sentry } from '../sentry';

@Catch(QueryFailedError)
export class TypeORMExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TypeORMExceptionFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    const code = (exception as any).code;

    // PostgreSQL error codes
    if (code === '23505') {
      status = HttpStatus.CONFLICT;
      message = 'A record with this unique value already exists.';
    } else if (code === '23503') {
      status = HttpStatus.BAD_REQUEST;
      message = 'Related record not found (Foreign Key Violation).';
    } else if (code === '23502') {
      status = HttpStatus.BAD_REQUEST;
      message = 'A required field is missing (Not Null Violation).';
    }

    // A code we have no friendly mapping for is a real 500, and this filter
    // shadows the catch-all Sentry one — so report it here or it is lost.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      Sentry.captureException(exception);
    }

    // Log the raw pg detail server-side only — it can contain schema/column/
    // constraint internals that must not leak to API clients.
    this.logger.error(
      `Database Error [${code}]: ${exception.message} on route ${request.method} ${request.url} — detail: ${(exception as any).detail}`,
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
    });
  }
}
