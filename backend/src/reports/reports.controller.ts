import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('task-summary')
  @Roles('ADMIN', 'MANAGER')
  async getTaskSummary(
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('manager_id') managerId?: string,
  ) {
    return this.reportsService.getTaskSummary(dateFrom, dateTo, managerId);
  }

  @Get('rep-performance')
  @Roles('MANAGER')
  async getRepPerformance(
    @CurrentUser() user: { sub: string },
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.reportsService.getRepPerformance(user.sub, dateFrom, dateTo);
  }

  @Get('user-activity')
  @Roles('ADMIN', 'MANAGER')
  async getUserActivity(
    @Query('user_id') userId: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.reportsService.getUserActivity(userId, dateFrom, dateTo);
  }

  @Get('email-stats')
  async getEmailStats(
    @CurrentUser() user: { sub: string },
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.reportsService.getEmailStats(user.sub, dateFrom, dateTo);
  }
}
