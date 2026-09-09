import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { FILTER_CATCH_EXCEPTIONS } from '@nestjs/common/constants';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from '../../src/common/prisma-exception.filter';

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('prisma error', {
    code,
    clientVersion: '5.22.0',
    meta,
  });
}

function checkViolationError(constraintName: string) {
  return new Prisma.PrismaClientUnknownRequestError(
    `\nInvalid \`prisma.nivelStock.create()\` invocation:\n\n\nError occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "23514", message: "new row for relation \\"niveles_stock\\" violates check constraint \\"${constraintName}\\"", severity: "ERROR", detail: None, column: None, hint: None }), transient: false })`,
    { clientVersion: '5.22.0' },
  );
}

function mockHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('PrismaExceptionFilter', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('expone PrismaClientKnownRequestError en el namespace Prisma en runtime', () => {
    expect(typeof Prisma.PrismaClientKnownRequestError).toBe('function');
    const err = knownError('P2002');
    expect(err).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(err.code).toBe('P2002');
  });

  it('@Catch registra PrismaClientKnownRequestError, PrismaClientValidationError y PrismaClientUnknownRequestError para que Nest despache el filtro', () => {
    const caught = Reflect.getMetadata(FILTER_CATCH_EXCEPTIONS, PrismaExceptionFilter);
    expect(caught).toEqual([
      Prisma.PrismaClientKnownRequestError,
      Prisma.PrismaClientValidationError,
      Prisma.PrismaClientUnknownRequestError,
    ]);
  });

  it('mapea P2002 a 409 Conflict', () => {
    const filter = new PrismaExceptionFilter();
    const { host, status, json } = mockHost();
    filter.catch(knownError('P2002', { target: ['email'] }), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      message: 'Ya existe un registro con esos datos.',
    });
  });

  it('mapea P2003 a 400 Bad Request', () => {
    const filter = new PrismaExceptionFilter();
    const { host, status, json } = mockHost();
    filter.catch(knownError('P2003', { target: ['equipoId'] }), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'El registro referenciado no existe.',
    });
  });

  it('mapea P2025 a 404 Not Found', () => {
    const filter = new PrismaExceptionFilter();
    const { host, status, json } = mockHost();
    filter.catch(knownError('P2025'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'El registro no existe.',
    });
  });

  it('registra el código Prisma y el target en el log del servidor, no en la respuesta', () => {
    const filter = new PrismaExceptionFilter();
    const { host, json } = mockHost();
    filter.catch(knownError('P2002', { target: ['nombre'] }), host);

    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(body).not.toHaveProperty('prismaCode');
    expect(body).not.toHaveProperty('target');
    expect(JSON.stringify(body)).not.toContain('nombre');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('P2002'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nombre'));
  });

  it('mapea un código Prisma no contemplado a 500', () => {
    const filter = new PrismaExceptionFilter();
    const { host, status, json } = mockHost();
    filter.catch(knownError('P2010'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno de base de datos.',
    });
  });

  it('mapea PrismaClientValidationError (enum inválido en un cast sin chequear) a 400', () => {
    const filter = new PrismaExceptionFilter();
    const { host, status, json } = mockHost();
    const err = new Prisma.PrismaClientValidationError(
      "Invalid value for argument `status`. Expected EstadoPedidoPublico.\n  status: 'bogus'",
      { clientVersion: '5.22.0' },
    );
    filter.catch(err, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Parámetro o dato inválido.',
    });
  });

  it('no filtra el mensaje interno de PrismaClientValidationError al cliente', () => {
    const filter = new PrismaExceptionFilter();
    const { host, json } = mockHost();
    const err = new Prisma.PrismaClientValidationError(
      "Invalid value for argument `status`. Expected EstadoPedidoPublico.\n  status: 'bogus'",
      { clientVersion: '5.22.0' },
    );
    filter.catch(err, host);

    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain('EstadoPedidoPublico');
    expect(JSON.stringify(body)).not.toContain('bogus');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('bogus'));
  });

  it('mapea una violación de CHECK constraint (SQLSTATE 23514) a 400 Bad Request', () => {
    const filter = new PrismaExceptionFilter();
    const { host, status, json } = mockHost();
    filter.catch(checkViolationError('niveles_stock_quantity_no_negativa'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Parámetro o dato inválido.',
    });
  });

  it('no filtra el nombre de la restricción CHECK violada al cliente, pero sí lo registra en el log', () => {
    const filter = new PrismaExceptionFilter();
    const { host, json } = mockHost();
    filter.catch(checkViolationError('niveles_stock_quantity_no_negativa'), host);

    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain('niveles_stock_quantity_no_negativa');
    expect(JSON.stringify(body)).not.toContain('violates check constraint');
    expect(JSON.stringify(body)).not.toContain('23514');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('niveles_stock_quantity_no_negativa'),
    );
  });

  it('mapea un PrismaClientUnknownRequestError que no es un CHECK constraint a 500', () => {
    const filter = new PrismaExceptionFilter();
    const { host, status, json } = mockHost();
    const err = new Prisma.PrismaClientUnknownRequestError('algo raro pasó en el motor', {
      clientVersion: '5.22.0',
    });
    filter.catch(err, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno de base de datos.',
    });
  });
});
