import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OutlookService } from '../email/outlook/outlook.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private supabaseService: SupabaseService,
    private notificationsService: NotificationsService,
    private outlookService: OutlookService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async sendDailyTaskEmails() {
    this.logger.log('Checking manager reminder settings...');
    const supabase = this.supabaseService.getClient();
    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];

    const { data: settings } = await supabase
      .from('daily_reminder_settings')
      .select('*')
      .eq('is_enabled', true);

    if (!settings) return;

    for (const setting of settings) {
      if (setting.reminder_time.slice(0, 5) !== currentHHMM) continue;

      const lastSent = setting.last_sent_at ? setting.last_sent_at.split('T')[0] : '';
      if (lastSent === today) continue;

      const { data: manager } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, role')
        .eq('id', setting.user_id)
        .single();

      if (!manager || manager.role !== 'MANAGER') continue;

      const { data: assignments } = await supabase
        .from('manager_rep_assignments')
        .select('rep_id')
        .eq('manager_id', manager.id);

      const repIds = (assignments || []).map(a => a.rep_id);
      if (repIds.length === 0) continue;

      const { data: reps } = await supabase
        .from('users')
        .select('id, email, first_name, last_name')
        .in('id', repIds);

      for (const rep of reps || []) {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('title, status, priority, due_date')
          .eq('assigned_to', rep.id)
          .in('status', ['PENDING', 'IN_PROGRESS']);

        if (!tasks || tasks.length === 0) continue;

        const taskList = tasks.map(t =>
          `- ${t.title} [${t.priority}] (Due: ${t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No due date'})`
        ).join('\n');

        const subject = `Daily Task Summary - ${new Date().toLocaleDateString()}`;
        const body = `
          <p>Hi ${rep.first_name},</p>
          <p>Here are your tasks for today:</p>
          <pre>${taskList}</pre>
          <p>Regards,<br/>${manager.first_name} ${manager.last_name}</p>
        `.trim();

        try {
          await this.outlookService.sendEmail(
            { subject, body, to_emails: [rep.email] },
            manager.id,
          );
          this.logger.log(`Sent daily task email to ${rep.email} from ${manager.email}`);
        } catch (err: any) {
          this.logger.error(`Failed to send email to ${rep.email}: ${err.message}`);
        }
      }

      await supabase
        .from('daily_reminder_settings')
        .update({ last_sent_at: now.toISOString() })
        .eq('id', setting.id);
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
