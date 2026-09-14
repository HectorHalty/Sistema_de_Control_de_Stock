import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import * as bcrypt from 'bcrypt';
import { RolUsuario } from '@prisma/client';
import { isKnownRole, assertAssignableRole, MIN_PASSWORD_LENGTH, ROLES } from '../common/roles';

const SALT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string, ip?: string) {
    if (!username || !password) {
      throw new BadRequestException('Username and password are required');
    }
    const key = username.toLowerCase();

    // Check lockout (contador en Postgres: compartido entre instancias de la API)
    const attempts = await this.prisma.intentoLogin.findUnique({ where: { username: key } });
    if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS) {
      const elapsed = Date.now() - attempts.lastAttempt.getTime();
      if (elapsed < LOCKOUT_WINDOW_MS) {
        const remaining = Math.ceil((LOCKOUT_WINDOW_MS - elapsed) / 60000);
        throw new UnauthorizedException(`Too many failed attempts. Try again in ${remaining} minute(s)`);
      }
      // Lockout expired, reset
      await this.prisma.intentoLogin.deleteMany({ where: { username: key } });
    }

    const user = await this.prisma.usuario.findUnique({ where: { username: key } });

    if (!user) {
      await this.recordFailedAttempt(key);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reject placeholder hashes (migration safety)
    if (user.password === 'placeholder' || !user.password.startsWith('$2')) {
      await this.recordFailedAttempt(key);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      await this.recordFailedAttempt(key);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!isKnownRole(user.role)) {
      throw new UnauthorizedException('Account is not authorized');
    }

    // Reset attempts on success
    await this.prisma.intentoLogin.deleteMany({ where: { username: key } });

    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id: user.id, username: user.username, role: user.role },
    };
  }

  /**
   * Create a new user with hashed password.
   * Used by admin endpoints or seed scripts — NOT auto-provisioned on login.
   */
  async createUser(username: string, password: string, name: string, role: RolUsuario = ROLES.VENDEDOR) {
    const existing = await this.prisma.usuario.findUnique({ where: { username: username.toLowerCase() } });
    if (existing) {
      throw new BadRequestException(`User ${username} already exists`);
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const normalizedRole = assertAssignableRole(role);
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    return this.prisma.usuario.create({
      data: {
        username: username.toLowerCase(),
        name,
        role: normalizedRole,
        password: hashedPassword,
      },
      select: { id: true, username: true, name: true, role: true },
    });
  }

  /**
   * Change user password.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) throw new UnauthorizedException('Current password is incorrect');

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const hashedNew = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { password: hashedNew },
    });
  }

  async validateUser(userId: string) {
    return this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true },
    });
  }

  /** Upsert atómico: dos intentos fallidos simultáneos incrementan sin pisarse. */
  private async recordFailedAttempt(key: string) {
    await this.prisma.intentoLogin.upsert({
      where: { username: key },
      create: { username: key, count: 1, lastAttempt: new Date() },
      update: { count: { increment: 1 }, lastAttempt: new Date() },
    });
  }
}
