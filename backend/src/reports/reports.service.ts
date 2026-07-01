import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ReportsService {
  constructor(private supabaseService: SupabaseService) {}

  async getTaskSummary(dateFrom?: string, dateTo?: string, managerId?: string) {
    const supabase = this.supabaseService.getClient();
    let query = supabase.from('tasks').select('*');

    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    if (managerId) {
      const { data: assignments } = await supabase
        .from('manager_rep_assignments')
        .select('rep_id')
        .eq('manager_id', managerId);
      const repIds = (assignments || []).map(a => a.rep_id);
      query = query.in('assigned_to', repIds);
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    const total = tasks?.length || 0;
    const byStatus = {
      PENDING: tasks?.filter(t => t.status === 'PENDING').length || 0,
      IN_PROGRESS: tasks?.filter(t => t.status === 'IN_PROGRESS').length || 0,
      COMPLETED: tasks?.filter(t => t.status === 'COMPLETED').length || 0,
      CANCELLED: tasks?.filter(t => t.status === 'CANCELLED').length || 0,
    };
    const byType = {
      EMAIL: tasks?.filter(t => t.task_type === 'EMAIL').length || 0,
      CALL: tasks?.filter(t => t.task_type === 'CALL').length || 0,
      LINKEDIN: tasks?.filter(t => t.task_type === 'LINKEDIN').length || 0,
      MEETING: tasks?.filter(t => t.task_type === 'MEETING').length || 0,
      FOLLOW_UP: tasks?.filter(t => t.task_type === 'FOLLOW_UP').length || 0,
      OTHER: tasks?.filter(t => t.task_type === 'OTHER').length || 0,
    };

    return { total, byStatus, byType };
  }

  async getRepPerformance(managerId: string, dateFrom?: string, dateTo?: string) {
    const supabase = this.supabaseService.getClient();

    const { data: assignments } = await supabase
      .from('manager_rep_assignments')
      .select('rep_id')
      .eq('manager_id', managerId);

    const repIds = (assignments || []).map(a => a.rep_id);

    if (repIds.length === 0) return [];

    const { data: users } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .in('id', repIds);

    let taskQuery = supabase.from('tasks').select('*').in('assigned_to', repIds);
    if (dateFrom) taskQuery = taskQuery.gte('created_at', dateFrom);
    if (dateTo) taskQuery = taskQuery.lte('created_at', dateTo);

    const { data: tasks } = await taskQuery;

    const performance = (users || []).map(user => {
      const userTasks = (tasks || []).filter(t => t.assigned_to === user.id);
      return {
        user,
        total_tasks: userTasks.length,
        completed: userTasks.filter(t => t.status === 'COMPLETED').length,
        in_progress: userTasks.filter(t => t.status === 'IN_PROGRESS').length,
        pending: userTasks.filter(t => t.status === 'PENDING').length,
        completion_rate: userTasks.length > 0
          ? Math.round((userTasks.filter(t => t.status === 'COMPLETED').length / userTasks.length) * 100)
          : 0,
      };
    });

    return performance;
  }

  async getUserActivity(userId: string, dateFrom?: string, dateTo?: string) {
    const supabase = this.supabaseService.getClient();
    let query = supabase
      .from('task_activities')
      .select('*, tasks!task_activities_task_id_fkey(title, task_type)')
      .eq('user_id', userId);

    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getEmailStats(userId: string, dateFrom?: string, dateTo?: string) {
    const supabase = this.supabaseService.getClient();
    let query = supabase
      .from('email_logs')
      .select('*')
      .eq('user_id', userId);

    if (dateFrom) query = query.gte('sent_at', dateFrom);
    if (dateTo) query = query.lte('sent_at', dateTo);

    const { data, error } = await query;
    if (error) throw error;

    return {
      total_sent: data?.length || 0,
      drafts: data?.filter(e => e.is_draft).length || 0,
      sent: data?.filter(e => !e.is_draft).length || 0,
    };
  }
}
