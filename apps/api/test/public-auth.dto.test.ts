import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto, RegisterDto } from '../src/public/dto/public-auth.dto';

describe('Public auth DTOs', () => {
  it('accepts valid register payload', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'jugador@lachacra.test',
      password: 'jugador123',
      nombre: 'Juan Pérez',
      dni: '30123456',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects register with short password', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.com',
      password: '123',
      nombre: 'Test',
      dni: '30123456',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects register with invalid email', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'not-an-email',
      password: 'secret12',
      nombre: 'Test',
      dni: '30123456',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('accepts valid login payload', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'capitan@lachacra.test',
      password: 'capitan123',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects login without password', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'capitan@lachacra.test',
      password: '',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
