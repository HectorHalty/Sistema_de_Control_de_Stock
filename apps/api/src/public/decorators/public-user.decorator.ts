import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type PublicAuthUser = {
  id: string;
  email: string;
  rol: string;
  personaId?: string | null;
  equipoInscripcionId?: string;
  torneoId?: string;
  tieneStatsPersonales?: boolean;
};

export const PublicUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicAuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
