import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PublicCaptainService } from './public-me.service';
import { RosterPlayerDto } from './dto/public-auth.dto';
import { PublicAuthGuard } from './guards/public-auth.guard';
import { PublicCaptainGuard } from './guards/public-captain.guard';
import { PublicUser, type PublicAuthUser } from './decorators/public-user.decorator';

@Controller('public/captain')
@UseGuards(PublicAuthGuard, PublicCaptainGuard)
export class PublicCaptainController {
  constructor(private captain: PublicCaptainService) {}

  @Get('team')
  getTeam(@PublicUser() user: PublicAuthUser) {
    return this.captain.getTeam(user.id);
  }

  @Post('roster')
  addPlayer(@PublicUser() user: PublicAuthUser, @Body() dto: RosterPlayerDto) {
    return this.captain.addPlayer(user.id, dto);
  }

  @Put('roster/:personaId')
  updatePlayer(
    @PublicUser() user: PublicAuthUser,
    @Param('personaId') personaId: string,
    @Body() dto: Partial<RosterPlayerDto>,
  ) {
    return this.captain.updatePlayer(user.id, personaId, dto);
  }

  @Delete('roster/:personaId')
  removePlayer(@PublicUser() user: PublicAuthUser, @Param('personaId') personaId: string) {
    return this.captain.removePlayer(user.id, personaId);
  }
}
