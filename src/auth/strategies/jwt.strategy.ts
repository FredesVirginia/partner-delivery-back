import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { envs } from '../../config';
import { User } from '../../users/entity/user.entity';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: envs.jwtAccessSecret,
    });
  }

  /**
   * Se ejecuta tras validar firma y expiración. Confirmamos que el usuario
   * sigue existiendo y activo, y que el token no quedó invalidado por un
   * cambio de contraseña posterior. Lo que devolvemos queda en req.user.
   */
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario inexistente o inactivo');
    }

    return user;
  }
}
