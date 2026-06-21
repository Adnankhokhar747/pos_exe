import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainException } from '../exceptions/domain-exception';

// Maps typed domain exceptions to RFC 7807 Problem Details, per docs/02-api-design.md §1.
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    response.status(exception.httpStatus).json({
      type: `https://errors.vantagepos.dev/${exception.code}`,
      title: exception.code,
      status: exception.httpStatus,
      detail: exception.message,
      instance: request.originalUrl,
    });
  }
}
