import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';
import {
  assertAssignableRole,
  MIN_PASSWORD_LENGTH,
  normalizeApiRole,
  ROLES,
} from '../common/roles';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto } from './dto';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: { id: true, username: true, name: true, role: true, createdAt: true, updatedAt: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateUserDto) {
    const username = dto.username.trim().toLowerCase();
    if (username.length < 3) {
      throw new BadRequestException('Username must be at least 3 characters');
    }
    if (dto.password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    let role: string;
    try {
      role = assertAssignableRole(dto.role);
    } catch {
      throw new BadRequestException(`Invalid role: ${dto.role}`);
    }
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new BadRequestException(`User ${username} already exists`);
    }

    const password = await bcrypt.hash(dto.password, SALT_ROUNDS);
    return this.prisma.user.create({
      data: { username, name: dto.name.trim(), role, password },
      select: { id: true, username: true, name: true, role: true, createdAt: true, updatedAt: true },
    });
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    let role: string;
    try {
      role = assertAssignableRole(dto.role);
    } catch {
      throw new BadRequestException(`Invalid role: ${dto.role}`);
    }

    await this.assertCanModifyPrivilegedUser(user.id, user.role, actorId, role);

    return this.prisma.user.update({
      where: { id },
      data: { name: dto.name.trim(), role },
      select: { id: true, username: true, name: true, role: true, createdAt: true, updatedAt: true },
    });
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.assertCanModifyPrivilegedUser(user.id, user.role, actorId, user.role);
    await this.assertNotLastSuperAdmin(user.id, user.role);

    await this.prisma.user.delete({ where: { id } });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const match = await bcrypt.compare(dto.currentPassword, user.password);
    if (!match) throw new ForbiddenException('Current password is incorrect');

    if (dto.newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const password = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { password } });
  }

  private async assertNotLastSuperAdmin(userId: string, role: string) {
    const normalized = normalizeApiRole(role);
    if (normalized !== ROLES.SUPER_ADMIN && normalized !== ROLES.ADMIN) return;

    const admins = await this.prisma.user.count({
      where: {
        id: { not: userId },
        role: { in: [ROLES.SUPER_ADMIN, ROLES.ADMIN] },
      },
    });
    if (admins === 0) {
      throw new BadRequestException('Cannot delete the last administrator');
    }
  }

  private async assertCanModifyPrivilegedUser(
    targetId: string,
    targetRole: string,
    actorId: string,
    nextRole: string,
  ) {
    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
    if (!actor) throw new ForbiddenException('Actor not found');

    const actorNormalized = normalizeApiRole(actor.role);
    const actorIsSuper = actorNormalized === ROLES.SUPER_ADMIN || actorNormalized === ROLES.ADMIN;
    if (!actorIsSuper) {
      throw new ForbiddenException('Only Super Admin can manage users');
    }

    const privileged = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
    const targetIsPrivileged = privileged.includes(normalizeApiRole(targetRole) as typeof ROLES.SUPER_ADMIN);
    const nextIsPrivileged = privileged.includes(normalizeApiRole(nextRole) as typeof ROLES.SUPER_ADMIN);

    if (targetId === actorId && nextIsPrivileged !== targetIsPrivileged) {
      throw new BadRequestException('You cannot change your own privilege level');
    }
  }
}
