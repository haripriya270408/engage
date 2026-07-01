import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ReportsService {
  constructor(private supabaseService: SupabaseService) {}

  async getTaskSummary(userId: string, userRole: string, startDate?: string, endDate?: string) {
    const supabase = this.supabaseService.getClient();
    let query = supabase.from('tasks').select('*');

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    if (userRole === 'REP') {
      query = query.eq('assigned_to', userId);
    } else if (userRole === 'MANAGER') {
      const { data: assignments } = await supabase
        .from('manager_rep_assignments')
        .select('rep_id')
        .eq('manager_id', userId);
      const repIds = (assignments || []).map(a => a.rep_id);
      repIds.push(userId);
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

  async getRepPerformance(userId: string, userRole: string, startDate?: string, endDate?: string) {
    const supabase = this.supabaseService.getClient();

    let repIds: string[];

    if (userRole === 'ADMIN') {
      const { data: allUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'REP');
      repIds = (allUsers || []).map(u => u.id);
    } else {
      const { data: assignments } = await supabase
        .from('manager_rep_assignments')
        .select('rep_id')
        .eq('manager_id', userId);
      repIds = (assignments || []).map(a => a.rep_id);
    }

    if (repIds.length === 0) return [];

    const { data: users } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .in('id', repIds);

    let taskQuery = supabase.from('tasks').select('*').in('assigned_to', repIds);
    if (startDate) taskQuery = taskQuery.gte('created_at', startDate);
    if (endDate) taskQuery = taskQuery.lte('created_at', endDate);

    const { data: tasks } = await taskQuery;

    const performance = (users || []).map(user => {
      const userTasks = (tasks || []).filter(t => t.assigned_to === user.id);
      return {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        total_tasks: userTasks.length,
        completed: userTasks.filter(t => t.status === 'COMPLETED').length,
        completion_rate: userTasks.length > 0
          ? Math.round((userTasks.filter(t => t.status === 'COMPLETED').length / userTasks.length) * 100)
          : 0,
      };
    });

    return performance;
  }

  async getUserActivity(userId: string, userRole: string, startDate?: string, endDate?: string, activityType?: string) {
    const supabase = this.supabaseService.getClient();
    let query = supabase
      .from('task_activities')
      .select('*, users!task_activities_user_id_fkey(id, email, first_name, last_name)');

    if (userRole === 'REP') {
      query = query.eq('user_id', userId);
    } else if (userRole === 'MANAGER') {
      const { data: assignments } = await supabase
        .from('manager_rep_assignments')
        .select('rep_id')
        .eq('manager_id', userId);
      const repIds = (assignments || []).map(a => a.rep_id);
      repIds.push(userId);
      query = query.in('user_id', repIds);
    }

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);
    if (activityType) query = query.eq('activity_type', activityType);

    const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
    if (error) throw error;

    const activities = (data || []).map((a: any) => ({
      id: a.id,
      user_name: a.users ? `${a.users.first_name} ${a.users.last_name}` : 'Unknown',
      activity_type: a.activity_type,
      description: a.description || '',
      created_at: a.created_at,
    }));

    return activities;
  }

  async getEmailStats(userId: string, startDate?: string, endDate?: string) {
    const supabase = this.supabaseService.getClient();
    let query = supabase
      .from('email_logs')
      .select('*')
      .eq('user_id', userId);

    if (startDate) query = query.gte('sent_at', startDate);
    if (endDate) query = query.lte('sent_at', endDate);

    const { data, error } = await query;
    if (error) throw error;

    return {
      total_sent: data?.length || 0,
      drafts: data?.filter(e => e.is_draft).length || 0,
      sent: data?.filter(e => !e.is_draft).length || 0,
    };
  }
}
