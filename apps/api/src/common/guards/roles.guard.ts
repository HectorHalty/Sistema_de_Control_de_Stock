import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasAnyRole, isKnownRole } from '../roles';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!isKnownRole(user.role)) {
      throw new ForbiddenException('User role is not recognized');
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException('Access policy not configured for this endpoint');
    }

    if (!hasAnyRole(user.role, requiredRoles)) {
      throw new ForbiddenException(
        `Role ${user.role} not authorized. Required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
