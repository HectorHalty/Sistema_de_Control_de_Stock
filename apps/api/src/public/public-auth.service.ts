import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';
import type { PublicJwtPayload, PublicRol, PublicSessionUser } from './types/public-auth.types';
import type { RegisterDto } from './dto/public-auth.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class PublicAuthService {
  private googleClient: OAuth2Client | null = null;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (clientId) {
      this.googleClient = new OAuth2Client(clientId);
    }
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const normalizedDni = dto.dni.replace(/\D/g, '');
    if (normalizedDni.length < 7) {
      throw new BadRequestException('DNI inválido');
    }

    const existing = await this.prisma.cuentaPublica.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con ese email');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const { nombre, apellido } = this.splitNombre(dto.nombre.trim());

    const persona = await this.prisma.persona.upsert({
      where: { dni: normalizedDni },
      update: {
        nombre,
        apellido,
        email,
      },
      create: {
        dni: normalizedDni,
        nombre,
        apellido,
        email,
      },
    });

    const cuenta = await this.prisma.cuentaPublica.create({
      data: {
        email,
        passwordHash,
        nombre: dto.nombre.trim(),
        dniConfirmado: normalizedDni,
        personaId: persona.id,
        rol: 'usuario',
      },
    });

    await this.resolveAndUpdateRole(cuenta.id);
    const session = await this.buildSessionUser(cuenta.id);
    const accessToken = await this.signToken(cuenta.id);
    return { accessToken, user: session };
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const cuenta = await this.prisma.cuentaPublica.findUnique({
      where: { email: normalizedEmail },
    });

    if (!cuenta?.passwordHash) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    const match = await bcrypt.compare(password, cuenta.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    await this.resolveAndUpdateRole(cuenta.id);
    const session = await this.buildSessionUser(cuenta.id);
    const accessToken = await this.signToken(cuenta.id);
    return { accessToken, user: session };
  }

  async loginWithGoogle(idToken: string) {
    const profile = await this.verifyGoogleToken(idToken);
    return this.upsertAndSign(profile.googleId, profile.email, profile.name, profile.picture);
  }

  async loginDev(email: string, name: string, googleId?: string) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Dev login disabled in production');
    }
    const gid = googleId ?? `dev-${email.toLowerCase()}`;
    return this.upsertAndSign(gid, email.toLowerCase(), name, null);
  }

  private async verifyGoogleToken(idToken: string) {
    if (!this.googleClient) {
      throw new BadRequestException(
        'Google OAuth no configurado. Usá POST /public/auth/login o configurá GOOGLE_CLIENT_ID.',
      );
    }
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')!;
    const ticket = await this.googleClient.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Token de Google inválido');
    }
    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name ?? payload.email,
      picture: payload.picture ?? null,
    };
  }

  private async upsertAndSign(
    googleId: string,
    email: string,
    name: string,
    avatarUrl: string | null,
  ) {
    let cuenta = await this.prisma.cuentaPublica.findUnique({ where: { googleId } });
    if (!cuenta) {
      cuenta = await this.prisma.cuentaPublica.findUnique({ where: { email } });
    }

    if (cuenta) {
      cuenta = await this.prisma.cuentaPublica.update({
        where: { id: cuenta.id },
        data: {
          googleId,
          email,
          nombre: cuenta.nombre ?? name,
          avatarUrl: avatarUrl ?? cuenta.avatarUrl,
        },
      });
    } else {
      cuenta = await this.prisma.cuentaPublica.create({
        data: { googleId, email, nombre: name, avatarUrl, rol: 'usuario' },
      });
    }

    if (cuenta.dniConfirmado) {
      await this.resolveAndUpdateRole(cuenta.id);
      cuenta = await this.prisma.cuentaPublica.findUniqueOrThrow({ where: { id: cuenta.id } });
    }

    const session = await this.buildSessionUser(cuenta.id);
    const accessToken = await this.signToken(cuenta.id);
    return { accessToken, user: session };
  }

  async completeDni(cuentaId: string, dni: string) {
    const normalizedDni = dni.replace(/\D/g, '');
    if (normalizedDni.length < 7) {
      throw new BadRequestException('DNI inválido');
    }

    const persona = await this.prisma.persona.upsert({
      where: { dni: normalizedDni },
      update: {},
      create: {
        dni: normalizedDni,
        nombre: 'Usuario',
        apellido: 'Web',
      },
    });

    await this.prisma.cuentaPublica.update({
      where: { id: cuentaId },
      data: {
        dniConfirmado: normalizedDni,
        personaId: persona.id,
      },
    });

    const rol = await this.resolveAndUpdateRole(cuentaId);
    const session = await this.buildSessionUser(cuentaId);
    const accessToken = await this.signToken(cuentaId);
    return { accessToken, user: session, rol };
  }

  async resolveAndUpdateRole(cuentaId: string): Promise<PublicRol> {
    const cuenta = await this.prisma.cuentaPublica.findUniqueOrThrow({
      where: { id: cuentaId },
    });
    const email = cuenta.email.toLowerCase();
    const dni = cuenta.dniConfirmado;

    if (dni) {
      const capitan = await this.prisma.capitanAutorizado.findFirst({
        where: {
          activo: true,
          email: { equals: email, mode: 'insensitive' },
          dni,
        },
        include: { equipoInscripcion: true },
      });

      if (capitan) {
        await this.prisma.$transaction([
          this.prisma.cuentaPublica.update({
            where: { id: cuentaId },
            data: { rol: 'capitan', equipoSeguidoId: null },
          }),
          this.prisma.capitanAutorizado.update({
            where: { id: capitan.id },
            data: { cuentaPublicaId: cuentaId },
          }),
        ]);
        return 'capitan';
      }

      const inscripcion = await this.prisma.inscripcionJugador.findFirst({
        where: {
          activa: true,
          persona: { dni },
        },
        include: { persona: true, equipoInscripcion: true },
      });

      if (inscripcion) {
        await this.prisma.cuentaPublica.update({
          where: { id: cuentaId },
          data: {
            rol: 'jugador',
            personaId: inscripcion.personaId,
            equipoSeguidoId: null,
          },
        });
        return 'jugador';
      }
    }

    if (cuenta.equipoSeguidoId) {
      await this.prisma.cuentaPublica.update({
        where: { id: cuentaId },
        data: { rol: 'seguidor' },
      });
      return 'seguidor';
    }

    await this.prisma.cuentaPublica.update({
      where: { id: cuentaId },
      data: { rol: 'usuario' },
    });
    return 'usuario';
  }

  async signToken(cuentaId: string) {
    const cuenta = await this.prisma.cuentaPublica.findUniqueOrThrow({
      where: { id: cuentaId },
      include: {
        capitanAutorizado: { include: { equipoInscripcion: true } },
        persona: {
          include: {
            inscripciones: { where: { activa: true }, take: 1, include: { equipoInscripcion: true } },
          },
        },
        equipoSeguido: true,
      },
    });

    const ctx = this.resolveContextFromCuenta(cuenta);
    const payload: PublicJwtPayload = {
      sub: cuenta.id,
      type: 'publico',
      rol: cuenta.rol as PublicRol,
      email: cuenta.email,
      equipoInscripcionId: ctx.equipoInscripcionId,
      torneoId: ctx.torneoId,
      personaId: cuenta.personaId ?? undefined,
      tieneStatsPersonales: cuenta.rol === 'jugador',
    };

    return this.jwt.sign(payload);
  }

  async buildSessionUser(cuentaId: string): Promise<PublicSessionUser> {
    const cuenta = await this.prisma.cuentaPublica.findUniqueOrThrow({
      where: { id: cuentaId },
    });

    const puedeSerCapitan = !!(await this.prisma.capitanAutorizado.findFirst({
      where: { activo: true, email: { equals: cuenta.email, mode: 'insensitive' } },
    }));

    const ctx = await this.getContextIds(cuentaId);

    return {
      id: cuenta.id,
      email: cuenta.email,
      nombre: cuenta.nombre,
      rol: cuenta.rol as PublicRol,
      avatarUrl: cuenta.avatarUrl,
      dniConfirmado: cuenta.dniConfirmado,
      personaId: cuenta.personaId,
      equipoInscripcionId: ctx.equipoInscripcionId,
      torneoId: ctx.torneoId,
      tieneStatsPersonales: cuenta.rol === 'jugador',
      needsDni: !cuenta.dniConfirmado,
      puedeSeguirEquipo: cuenta.rol !== 'jugador' && cuenta.rol !== 'capitan',
      puedeSerCapitan,
    };
  }

  private splitNombre(full: string) {
    const parts = full.trim().split(/\s+/);
    if (parts.length <= 1) {
      return { nombre: parts[0] ?? full, apellido: '' };
    }
    return {
      nombre: parts[0] ?? full,
      apellido: parts.slice(1).join(' '),
    };
  }

  private resolveContextFromCuenta(cuenta: {
    rol: string;
    personaId: string | null;
    equipoSeguidoId: string | null;
    capitanAutorizado: { equipoInscripcionId: string; torneoId: string } | null;
    persona: {
      inscripciones: { equipoInscripcionId: string; torneoId: string }[];
    } | null;
    equipoSeguido: { id: string; torneoId: string } | null;
  }) {
    if (cuenta.rol === 'capitan' && cuenta.capitanAutorizado) {
      return {
        equipoInscripcionId: cuenta.capitanAutorizado.equipoInscripcionId,
        torneoId: cuenta.capitanAutorizado.torneoId,
      };
    }
    if (cuenta.rol === 'jugador' && cuenta.persona?.inscripciones[0]) {
      const ins = cuenta.persona.inscripciones[0];
      return { equipoInscripcionId: ins.equipoInscripcionId, torneoId: ins.torneoId };
    }
    if (cuenta.rol === 'seguidor' && cuenta.equipoSeguido) {
      return { equipoInscripcionId: cuenta.equipoSeguido.id, torneoId: cuenta.equipoSeguido.torneoId };
    }
    return { equipoInscripcionId: undefined, torneoId: undefined };
  }

  async getContextIds(cuentaId: string) {
    const cuenta = await this.prisma.cuentaPublica.findUniqueOrThrow({
      where: { id: cuentaId },
      include: {
        capitanAutorizado: true,
        persona: { include: { inscripciones: { where: { activa: true }, take: 1 } } },
        equipoSeguido: true,
      },
    });
    return this.resolveContextFromCuenta(cuenta);
  }
}
