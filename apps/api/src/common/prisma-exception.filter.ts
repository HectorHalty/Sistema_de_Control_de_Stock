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

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof Prisma.PrismaClientValidationError) {
      // Se dispara, entre otros casos, cuando un valor de query param se
      // castea a un enum de Prisma (`status as EstadoTicket`) sin validarlo
      // antes: el cliente rechaza el valor al armar la consulta. El mensaje
      // completo puede incluir el nombre de campos y modelos internos, así
      // que solo va al log del servidor, nunca al cuerpo de la respuesta.
      this.logger.warn(`Prisma validation: ${exception.message.split('\n').pop()?.trim()}`);
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Parámetro o dato inválido.',
      });
      return;
    }

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
