import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './users.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  async findAll(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.findAll({ role, status, page, limit });
  }

  @Get('managers')
  @Roles('ADMIN')
  async getManagers() {
    return this.usersService.findByRole('MANAGER');
  }

  @Get('reps')
  @Roles('ADMIN', 'MANAGER')
  async getReps() {
    return this.usersService.findByRole('REP');
  }

  @Get('profile')
  async getProfile(@CurrentUser() user: { sub: string }) {
    return this.usersService.findById(user.sub);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }
}
