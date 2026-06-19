import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import * as bcrypt from 'bcrypt';
import { isKnownRole, assertAssignableRole, MIN_PASSWORD_LENGTH } from '../common/roles';

const SALT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-memory attempt tracker (use Redis in production)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

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

    // Check lockout
    const attempts = loginAttempts.get(username.toLowerCase());
    if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS) {
      const elapsed = Date.now() - attempts.lastAttempt;
      if (elapsed < LOCKOUT_WINDOW_MS) {
        const remaining = Math.ceil((LOCKOUT_WINDOW_MS - elapsed) / 60000);
        throw new UnauthorizedException(`Too many failed attempts. Try again in ${remaining} minute(s)`);
      }
      // Lockout expired, reset
      loginAttempts.delete(username.toLowerCase());
    }

    const user = await this.prisma.user.findUnique({ where: { username: username.toLowerCase() } });

    if (!user) {
      this.recordFailedAttempt(username, ip);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reject placeholder hashes (migration safety)
    if (user.password === 'placeholder' || !user.password.startsWith('$2')) {
      this.recordFailedAttempt(username, ip);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      this.recordFailedAttempt(username, ip);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!isKnownRole(user.role)) {
      throw new UnauthorizedException('Account is not authorized');
    }

    // Reset attempts on success
    loginAttempts.delete(username.toLowerCase());

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
  async createUser(username: string, password: string, name: string, role: string = 'Vendedor') {
    const existing = await this.prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (existing) {
      throw new BadRequestException(`User ${username} already exists`);
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const normalizedRole = assertAssignableRole(role);
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    return this.prisma.user.create({
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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) throw new UnauthorizedException('Current password is incorrect');

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const hashedNew = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNew },
    });
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true },
    });
  }

  private recordFailedAttempt(username: string, ip?: string) {
    const key = username.toLowerCase();
    const current = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
    loginAttempts.set(key, { count: current.count + 1, lastAttempt: Date.now() });
  }
}
