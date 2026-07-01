import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ReminderSettingsDto } from './notifications.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  async findAll(
    @CurrentUser() user: { sub: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.findAll(user.sub, page, limit);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.getUnreadCount(user.sub);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.notificationsService.markAsRead(id, user.sub);
  }

  @Post('mark-all-read')
  async markAllAsRead(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.markAllAsRead(user.sub);
  }

  @Get('reminder-settings')
  async getReminderSettings(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.getReminderSettings(user.sub);
  }

  @Post('reminder-settings')
  async upsertReminderSettings(
    @CurrentUser() user: { sub: string },
    @Body() dto: ReminderSettingsDto,
  ) {
    return this.notificationsService.upsertReminderSettings(user.sub, dto);
  }
}
