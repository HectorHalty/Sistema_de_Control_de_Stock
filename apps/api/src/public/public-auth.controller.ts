import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PublicAuthService } from './public-auth.service';
import { CompleteDniDto, DevAuthDto, GoogleAuthDto } from './dto/public-auth.dto';
import { PublicAuthGuard } from './guards/public-auth.guard';
import { PublicUser, type PublicAuthUser } from './decorators/public-user.decorator';

@Controller('public/auth')
export class PublicAuthController {
  constructor(private auth: PublicAuthService) {}

  @Post('google')
  loginGoogle(@Body() dto: GoogleAuthDto) {
    return this.auth.loginWithGoogle(dto.idToken);
  }

  @Post('dev')
  loginDev(@Body() dto: DevAuthDto) {
    return this.auth.loginDev(dto.email, dto.name, dto.googleId);
  }

  @Post('complete-dni')
  @UseGuards(PublicAuthGuard)
  completeDni(@PublicUser() user: PublicAuthUser, @Body() dto: CompleteDniDto) {
    return this.auth.completeDni(user.id, dto.dni);
  }
}
