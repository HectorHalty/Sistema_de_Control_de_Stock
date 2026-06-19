import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { USER_MANAGEMENT_ROLES } from '../common/roles';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(...USER_MANAGEMENT_ROLES)
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @Roles(...USER_MANAGEMENT_ROLES)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @Roles(...USER_MANAGEMENT_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser) {
    return this.usersService.update(id, dto, actor.id);
  }

  @Delete(':id')
  @Roles(...USER_MANAGEMENT_ROLES)
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.usersService.remove(id, actor.id);
  }
}
