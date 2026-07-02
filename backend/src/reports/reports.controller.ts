import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('task-summary')
  async getTaskSummary(
    @CurrentUser() user: { sub: string; role: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getTaskSummary(user.sub, user.role, startDate, endDate);
  }

  @Get('rep-performance')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async getRepPerformance(
    @CurrentUser() user: { sub: string; role: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getRepPerformance(user.sub, user.role, startDate, endDate);
  }

  @Get('user-activity')
  async getUserActivity(
    @CurrentUser() user: { sub: string; role: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('activity_type') activityType?: string,
  ) {
    return this.reportsService.getUserActivity(user.sub, user.role, startDate, endDate, activityType);
  }

  @Get('email-stats')
  async getEmailStats(
    @CurrentUser() user: { sub: string; role: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getEmailStats(user.sub, user.role, startDate, endDate);
  }
}
