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

  @Cron(CronExpression.EVERY_MINUTE)
  async sendDailyTaskEmails() {
    this.logger.log('Checking manager reminder settings...');
    const supabase = this.supabaseService.getClient();
    const now = new Date();

    // Use local date (not UTC) to avoid timezone mismatch for users in GMT+5:30 etc.
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const { data: settings } = await supabase
      .from('daily_reminder_settings')
      .select('*')
      .eq('is_enabled', true);

    if (!settings || settings.length === 0) {
      this.logger.log('No enabled reminder settings found.');
      return;
    }

    this.logger.log(`Found ${settings.length} enabled reminder setting(s). Local today: ${todayLocal}, Local time: ${now.toTimeString().slice(0, 5)}`);

    for (const setting of settings) {
      if (!setting.reminder_time) continue;

      const [remHH, remMM] = setting.reminder_time.split(':').map(Number);
      const remDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), remHH, remMM, 0);

      this.logger.log(`Setting [${setting.id}]: reminder_time=${setting.reminder_time}, last_sent_at=${setting.last_sent_at}, now=${now.toTimeString().slice(0,5)}, remDate=${remDate.toTimeString().slice(0,5)}`);

      // Skip if the configured time has not yet been reached today
      if (now < remDate) {
        this.logger.log(`Skipping: reminder time ${setting.reminder_time} not yet reached.`);
        continue;
      }

      const lastSentLocal = setting.last_sent_at
        ? (() => { const d = new Date(setting.last_sent_at); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })()
        : '';

      if (lastSentLocal === todayLocal) {
        this.logger.log(`Skipping: already sent today (last_sent_at=${setting.last_sent_at}).`);
        continue;
      }

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
      if (repIds.length === 0) {
        await supabase
          .from('daily_reminder_settings')
          .update({ last_sent_at: now.toISOString() })
          .eq('id', setting.id);
        continue;
      }

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
        const body = [
          `Hi ${rep.first_name},`,
          ``,
          `Here are your tasks for today:`,
          ``,
          taskList,
          ``,
          `Regards,`,
          `${manager.first_name} ${manager.last_name}`,
        ].join('\n');

        try {
          await this.outlookService.sendEmail(
            { subject, body, to_emails: [rep.email] },
            manager.id,
          );
          this.logger.log(`Sent daily task email to ${rep.email} from ${manager.email}`);
        } catch (err: any) {
          this.logger.error(`Failed to send email to ${rep.email}: ${err.message}`);
          this.logger.log(`[EMAIL FALLBACK LOG] To: ${rep.email}, Subject: ${subject}\nBody:\n${body}`);
        }

        // Also create a system notification in-app for the Rep
        try {
          await this.notificationsService.create({
            user_id: rep.id,
            title: `Daily Tasks Summary from ${manager.first_name} ${manager.last_name}`,
            message: `You have ${tasks.length} pending/in-progress tasks today.`,
            type: 'info',
            link: '/tasks',
          });
        } catch (err: any) {
          this.logger.error(`Failed to create system notification for ${rep.email}: ${err.message}`);
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
