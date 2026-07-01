import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private supabaseService: SupabaseService,
    private notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDailyReminders() {
    this.logger.log('Sending daily reminders...');
    const supabase = this.supabaseService.getClient();

    const { data: settings } = await supabase
      .from('daily_reminder_settings')
      .select('*, users!daily_reminder_settings_user_id_fkey(email, first_name, last_name)')
      .eq('is_enabled', true);

    if (!settings) return;

    for (const setting of settings) {
      const today = new Date().toISOString().split('T')[0];

      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', setting.user_id)
        .in('status', ['PENDING', 'IN_PROGRESS'])
        .lte('due_date', `${today}T23:59:59Z`);

      if (count && count > 0) {
        await this.notificationsService.create({
          user_id: setting.user_id,
          title: 'Daily Task Reminder',
          message: `You have ${count} pending task(s) due soon.`,
          type: 'reminder',
          link: '/tasks',
        });

        await supabase
          .from('daily_reminder_settings')
          .update({ last_sent_at: new Date().toISOString() })
          .eq('id', setting.id);
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkOverdueTasks() {
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    const { data: overdueTasks } = await supabase
      .from('tasks')
      .select('id, title, assigned_to')
      .in('status', ['PENDING', 'IN_PROGRESS'])
      .lt('due_date', now);

    if (!overdueTasks) return;

    for (const task of overdueTasks) {
      if (task.assigned_to) {
        await this.notificationsService.create({
          user_id: task.assigned_to,
          title: 'Overdue Task',
          message: `Task "${task.title}" is overdue.`,
          type: 'warning',
          link: `/tasks/${task.id}`,
        });
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredTokens() {
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('outlook_connections')
      .update({ is_active: false, updated_at: now })
      .lt('token_expires_at', now)
      .eq('is_active', true);

    if (error) {
      this.logger.error('Failed to cleanup expired tokens:', error.message);
    }
  }
}
