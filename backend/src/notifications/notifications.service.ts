import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateNotificationDto, ReminderSettingsDto } from './notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private supabaseService: SupabaseService) {}

  async findAll(userId: string, page = 1, limit = 20) {
    const supabase = this.supabaseService.getClient();
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  async markAllAsRead(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return { message: 'All notifications marked as read' };
  }

  async getUnreadCount(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return { unread_count: count || 0 };
  }

  async create(dto: CreateNotificationDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('notifications')
      .insert(dto)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  async getReminderSettings(userId: string, userRole: string) {
    const supabase = this.supabaseService.getClient();
    if (userRole === 'REP') {
      const { data: assignments } = await supabase
        .from('manager_rep_assignments')
        .select('manager_id')
        .eq('rep_id', userId)
        .maybeSingle();
      if (assignments) {
        const { data, error } = await supabase
          .from('daily_reminder_settings')
          .select('*')
          .eq('user_id', assignments.manager_id)
          .maybeSingle();
        if (error) throw error;
        return data ? { enabled: data.is_enabled, reminder_time: data.reminder_time, readonly: true } : { enabled: false, reminder_time: '09:00:00', readonly: true };
      }
      return { enabled: false, reminder_time: '09:00:00', readonly: true };
    }
    const { data, error } = await supabase
      .from('daily_reminder_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { enabled: false, reminder_time: '09:00:00' };
    return { enabled: data.is_enabled, reminder_time: data.reminder_time };
  }

  async upsertReminderSettings(userId: string, dto: ReminderSettingsDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('daily_reminder_settings')
      .upsert(
        { user_id: userId, ...dto, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }
}
