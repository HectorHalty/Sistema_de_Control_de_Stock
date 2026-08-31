import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PublicAuthGuard extends AuthGuard('public-jwt') {
  handleRequest<T>(err: Error | null, user: T, _info: unknown, _ctx: ExecutionContext): T {
    if (err || !user) {
      throw err || new UnauthorizedException('Autenticación requerida');
    }
    return user;
  }
}
