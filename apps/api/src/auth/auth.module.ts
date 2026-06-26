import { Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { SecurityLogger } from '../common/security-logger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

const WEAK_SECRETS = new Set(['dev-secret', 'secret', 'password', '123456', 'jwt-secret', 'changeme', '']);
const MIN_SECRET_LENGTH = 32;

function validateJwtSecret(secret: string | undefined, isDev: boolean): void {
  if (!secret || WEAK_SECRETS.has(secret.toLowerCase())) {
    if (!isDev) {
      throw new Error(
        `JWT_SECRET is not configured securely. ` +
        `Set a strong secret (at least ${MIN_SECRET_LENGTH} characters) in production. ` +
        `Received: ${secret ? '(weak value)' : '(empty)'}`,
      );
    }
    return;
  }
  if (!isDev && secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production ` +
      `(got ${secret.length} characters).`,
    );
  }
}

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const isDev = config.get<string>('NODE_ENV', 'development') !== 'production';
        const secret = (config.get('JWT_SECRET') as string) ?? (isDev ? 'dev-secret' : '');

        validateJwtSecret(secret, isDev);

        return {
          secret,
          signOptions: {
            expiresIn: ((config.get('JWT_EXPIRES_IN') as string) ?? '1h') as StringValue,
            issuer: 'lch-stock-api',
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SecurityLogger, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule implements OnModuleInit {
  constructor(private config: ConfigService) {}

  onModuleInit() {
    const isDev = this.config.get<string>('NODE_ENV', 'development') !== 'production';
    const secret = (this.config.get('JWT_SECRET') as string) ?? (isDev ? 'dev-secret' : '');
    validateJwtSecret(secret, isDev);
  }
}
