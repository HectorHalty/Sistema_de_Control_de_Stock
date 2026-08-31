import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import type { PublicJwtPayload } from './types/public-auth.types';

@Injectable()
export class PublicJwtStrategy extends PassportStrategy(Strategy, 'public-jwt') {
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

  async validate(payload: PublicJwtPayload) {
    if (!payload?.sub || payload.type !== 'publico') {
      throw new UnauthorizedException('Invalid public token');
    }

    const cuenta = await this.prisma.cuentaPublica.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, rol: true, personaId: true },
    });

    if (!cuenta) {
      throw new UnauthorizedException('Cuenta pública no encontrada');
    }

    return {
      id: cuenta.id,
      email: cuenta.email,
      rol: cuenta.rol,
      personaId: cuenta.personaId,
      equipoInscripcionId: payload.equipoInscripcionId,
      torneoId: payload.torneoId,
      tieneStatsPersonales: payload.tieneStatsPersonales,
    };
  }
}
