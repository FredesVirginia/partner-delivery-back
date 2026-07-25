import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { envs } from '../config';
import { User } from '../users/entity/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshToken } from './entity/refresh-token.entity';
import {
  JwtPayload,
  RefreshTokenPayload,
} from './interfaces/jwt-payload.interface';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // segundos de vida del access token
}

export interface AuthResult extends AuthTokens {
  user: User;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    if (await this.usersService.existsByEmail(dto.email)) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      userName: dto.userName,
      address: dto.address,
      phone: dto.phone,
      neighborhood: dto.neighborhood,
      location: dto.location,
      passwordHash,
      role: UserRole.CLIENT,
    });

    const tokens = await this.issueTokens(user);
    return { user, ...tokens };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);

    // Verificamos siempre contra un hash (aunque el user no exista) para no
    // filtrar por tiempo si el correo está o no registrado.
    const passwordOk = user
      ? await argon2.verify(user.passwordHash, dto.password)
      : await argon2
          .verify(
            '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$RdescudvJCsgt3ub+b+dWRWJTmaaJObG',
            dto.password,
          )
          .catch(() => false);

    if (!user || !passwordOk) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('La cuenta está inactiva');
    }

    const tokens = await this.issueTokens(user);
    return { user, ...tokens };
  }

  async refresh(presentedToken: string): Promise<AuthTokens> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        presentedToken,
        { secret: envs.jwtRefreshSecret },
      );
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const record = await this.refreshTokenRepository.findOne({
      where: { id: payload.tokenId },
    });
    if (!record) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    // Reuso de un token ya rotado: posible robo. Revocamos todo por seguridad.
    if (record.revokedAt) {
      await this.revokeAllForUser(record.userId);
      throw new UnauthorizedException('Refresh token ya utilizado');
    }

    const matches = await argon2.verify(record.tokenHash, presentedToken);
    if (!matches || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = await this.usersService.findById(record.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario inexistente o inactivo');
    }

    // Rotación: revocamos el token actual y emitimos un par nuevo.
    record.revokedAt = new Date();
    await this.refreshTokenRepository.save(record);

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.revokeAllForUser(userId);
    this.logger.log(`Sesiones revocadas para el usuario ${userId}`);
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: envs.jwtAccessSecret,
      expiresIn: envs.jwtAccessTtl as JwtSignOptions['expiresIn'],
    });

    // Pre-generamos el id del registro para poder firmarlo dentro del token.
    const tokenId = randomUUID();
    const refreshPayload: RefreshTokenPayload = { sub: user.id, tokenId };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: envs.jwtRefreshSecret,
      expiresIn: envs.jwtRefreshTtl as JwtSignOptions['expiresIn'],
    });

    const decoded = this.jwtService.decode<{ exp: number }>(refreshToken);
    const record = this.refreshTokenRepository.create({
      id: tokenId,
      userId: user.id,
      tokenHash: await argon2.hash(refreshToken),
      expiresAt: new Date(decoded.exp * 1000),
    });
    await this.refreshTokenRepository.save(record);

    const accessDecoded = this.jwtService.decode<{ exp: number; iat: number }>(
      accessToken,
    );
    return {
      accessToken,
      refreshToken,
      expiresIn: accessDecoded.exp - accessDecoded.iat,
    };
  }

  private async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
