import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { isKnownRole } from '../common/roles';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    const isDev = config.get<string>('NODE_ENV', 'development') !== 'production';
    const secret = (config.get('JWT_SECRET') as string) ?? (isDev ? 'dev-secret' : '');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub?: string }) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    if (!isKnownRole(user.role)) {
      throw new UnauthorizedException('User role is not recognized');
    }

    return user;
  }
}
