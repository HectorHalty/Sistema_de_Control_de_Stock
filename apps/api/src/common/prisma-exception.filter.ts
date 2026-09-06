import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

const STATUS_BY_CODE: Record<string, { status: number; message: string }> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    message: 'Ya existe un registro con esos datos.',
  },
  P2003: {
    status: HttpStatus.BAD_REQUEST,
    message: 'El registro referenciado no existe.',
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    message: 'El registro no existe.',
  },
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = STATUS_BY_CODE[exception.code];

    if (!mapped) {
      this.logger.error(`Prisma ${exception.code}: ${exception.message}`);
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno de base de datos.',
      });
      return;
    }

    this.logger.warn(
      `Prisma ${exception.code} en ${JSON.stringify(exception.meta?.target)}`,
    );

    response.status(mapped.status).json({
      statusCode: mapped.status,
      message: mapped.message,
    });
  }
}
