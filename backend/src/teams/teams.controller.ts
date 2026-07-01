import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { AssignRepsDto } from './teams.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('teams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Post('assign')
  @Roles('ADMIN')
  async assignReps(@Body() dto: AssignRepsDto) {
    return this.teamsService.assignReps(dto.manager_id, dto.rep_ids);
  }

  @Delete('unassign/:managerId/:repId')
  @Roles('ADMIN')
  async unassignRep(@Param('managerId') managerId: string, @Param('repId') repId: string) {
    return this.teamsService.unassignRep(managerId, repId);
  }

  @Get('my-team')
  @Roles('MANAGER')
  async getMyTeam(@CurrentUser() user: { sub: string }) {
    return this.teamsService.getManagerTeam(user.sub);
  }

  @Get('manager/:id')
  @Roles('ADMIN')
  async getManagerTeam(@Param('id') id: string) {
    return this.teamsService.getManagerTeam(id);
  }

  @Get('all')
  @Roles('ADMIN')
  async getAllTeams() {
    return this.teamsService.getAllTeams();
  }

  @Get('stats')
  @Roles('MANAGER')
  async getTeamStats(@CurrentUser() user: { sub: string }) {
    return this.teamsService.getTeamStats(user.sub);
  }
}
