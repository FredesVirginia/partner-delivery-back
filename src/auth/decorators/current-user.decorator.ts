import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../users/entity/user.entity';

/** Inyecta el usuario autenticado (req.user, poblado por JwtStrategy.validate). */
export const currentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<{ user: User }>();
    return request.user;
  },
);
