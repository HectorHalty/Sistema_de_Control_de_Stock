import { Controller, Post, Get, Body, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SecurityLogger } from '../common/security-logger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { ChangePasswordDto } from '../users/dto';

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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthUser) {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
