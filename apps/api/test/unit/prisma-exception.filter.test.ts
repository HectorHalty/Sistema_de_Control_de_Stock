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

  it('@Catch registra PrismaClientKnownRequestError para que Nest despache el filtro', () => {
    const caught = Reflect.getMetadata(FILTER_CATCH_EXCEPTIONS, PrismaExceptionFilter);
    expect(caught).toEqual([Prisma.PrismaClientKnownRequestError]);
  });

  it('mapea P2002 a 409 Conflict', () => {
    const filter = new PrismaExceptionFilter();
    const { host, status, json } = mockHost();
    filter.catch(knownError('P2002', { target: ['email'] }), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      message: 'Ya existe un registro con esos datos.',
      prismaCode: 'P2002',
      target: ['email'],
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
      prismaCode: 'P2003',
      target: ['equipoId'],
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
      prismaCode: 'P2025',
      target: undefined,
    });
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
});
