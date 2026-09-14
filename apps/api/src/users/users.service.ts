import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RolUsuario } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { assertAssignableRole, MIN_PASSWORD_LENGTH, ROLES } from '../common/roles';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto } from './dto';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.usuario.findMany({
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

    let role: RolUsuario;
    try {
      role = assertAssignableRole(dto.role ?? '');
    } catch {
      throw new BadRequestException(`Invalid role: ${dto.role}`);
    }
    const existing = await this.prisma.usuario.findUnique({ where: { username } });
    if (existing) {
      throw new BadRequestException(`User ${username} already exists`);
    }

    const password = await bcrypt.hash(dto.password, SALT_ROUNDS);
    return this.prisma.usuario.create({
      data: { username, name: dto.name.trim(), role, password },
      select: { id: true, username: true, name: true, role: true, createdAt: true, updatedAt: true },
    });
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const user = await this.prisma.usuario.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    let role: RolUsuario;
    try {
      role = assertAssignableRole(dto.role ?? '');
    } catch {
      throw new BadRequestException(`Invalid role: ${dto.role}`);
    }

    await this.assertCanModifyPrivilegedUser(user.id, user.role, actorId, role);

    return this.prisma.usuario.update({
      where: { id },
      data: { name: dto.name.trim(), role },
      select: { id: true, username: true, name: true, role: true, createdAt: true, updatedAt: true },
    });
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.prisma.usuario.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.assertCanModifyPrivilegedUser(user.id, user.role, actorId, user.role);
    await this.assertNotLastSuperAdmin(user.id, user.role);

    await this.prisma.usuario.delete({ where: { id } });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const match = await bcrypt.compare(dto.currentPassword, user.password);
    if (!match) throw new ForbiddenException('Current password is incorrect');

    if (dto.newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const password = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.prisma.usuario.update({ where: { id: userId }, data: { password } });
  }

  private async assertNotLastSuperAdmin(userId: string, role: RolUsuario) {
    if (role !== ROLES.SUPER_ADMIN && role !== ROLES.ADMIN) return;

    const admins = await this.prisma.usuario.count({
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
    targetRole: RolUsuario,
    actorId: string,
    nextRole: RolUsuario,
  ) {
    const actor = await this.prisma.usuario.findUnique({ where: { id: actorId }, select: { role: true } });
    if (!actor) throw new ForbiddenException('Actor not found');

    const actorIsSuper = actor.role === ROLES.SUPER_ADMIN || actor.role === ROLES.ADMIN;
    if (!actorIsSuper) {
      throw new ForbiddenException('Only Super Admin can manage users');
    }

    const privileged: RolUsuario[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
    const targetIsPrivileged = privileged.includes(targetRole);
    const nextIsPrivileged = privileged.includes(nextRole);

    if (targetId === actorId && nextIsPrivileged !== targetIsPrivileged) {
      throw new BadRequestException('You cannot change your own privilege level');
    }
  }
}
