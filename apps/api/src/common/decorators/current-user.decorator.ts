import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthUser = { id: string; username: string; role: string };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
