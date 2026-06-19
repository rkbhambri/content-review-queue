import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

const errorTypeMap: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.GONE]: 'Gone',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal server error',
};

const getErrorType = (statusCode: number): string =>
  errorTypeMap[statusCode] ?? 'Error';

/**
 * Normalizes every error into a consistent envelope:
 * `{ status: false, statusCode, message, error }`.
 */
@Catch()
export class ErrorResponseFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resMessage = (res as { message?: string | string[] }).message;
        if (Array.isArray(resMessage)) {
          message = resMessage.join(', ');
        } else if (resMessage) {
          message = resMessage;
        }
      }
    } else if (exception instanceof Error && exception.message) {
      message = exception.message;
    }

    response.status(statusCode).json({
      status: false,
      statusCode,
      message,
      error: getErrorType(statusCode),
    });
  }
}
