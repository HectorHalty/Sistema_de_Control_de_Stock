import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SecurityLogger } from '../common/security-logger';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private securityLogger: SecurityLogger,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { username: string; password: string }, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    try {
      const result = await this.authService.login(body.username, body.password, ip);
      this.securityLogger.successfulLogin(result.user.id, result.user.username, ip);
      return result;
    } catch (error) {
      this.securityLogger.failedLogin(body.username, ip);
      throw error;
    }
  }
}
