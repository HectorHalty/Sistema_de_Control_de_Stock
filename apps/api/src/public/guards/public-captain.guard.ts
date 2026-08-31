import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class PublicCaptainGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { rol?: string } | undefined;

    if (user?.rol !== 'capitan') {
      throw new ForbiddenException('Acceso solo para capitanes');
    }

    return true;
  }
}
