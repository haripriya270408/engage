import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTaskDto, UpdateTaskDto, TaskFilterDto, CreateNoteDto } from './tasks.dto';

@Injectable()
export class TasksService {
  constructor(private supabaseService: SupabaseService) {}

  async create(dto: CreateTaskDto, userId: string) {
    const supabase = this.supabaseService.getClient();
    const taskData = {
      ...dto,
      created_by: userId,
      assigned_by: dto.assigned_to ? userId : null,
      status: 'PENDING',
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select('*')
      .single();

    if (error) throw error;

    await this.logActivity(data.id, userId, 'CREATED', 'Task created');

    if (dto.assigned_to) {
      await this.logActivity(data.id, userId, 'ASSIGNED', `Task assigned to user ${dto.assigned_to}`);
    }

    return data;
  }

  async findAll(filters: TaskFilterDto, userId: string, userRole: string) {
    const supabase = this.supabaseService.getClient();
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    let builder = supabase
      .from('tasks')
      .select('*', { count: 'exact' });

    if (userRole === 'REP') {
      builder = builder.eq('assigned_to', userId);
    } else if (userRole === 'MANAGER') {
      const { data: assignments } = await supabase
        .from('manager_rep_assignments')
        .select('rep_id')
        .eq('manager_id', userId);
      const repIds = (assignments || []).map(a => a.rep_id);
      repIds.push(userId);
      builder = builder.in('assigned_to', repIds);
    }

    if (filters.task_type) builder = builder.eq('task_type', filters.task_type);
    if (filters.status) builder = builder.eq('status', filters.status);
    if (filters.assigned_to) builder = builder.eq('assigned_to', filters.assigned_to);
    if (filters.assigned_by) builder = builder.eq('assigned_by', filters.assigned_by);
    if (filters.due_date_from) builder = builder.gte('due_date', filters.due_date_from);
    if (filters.due_date_to) builder = builder.lte('due_date', filters.due_date_to);

    const { data, error, count } = await builder
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const enriched = await this.enrichTasks(data || []);

    return {
      data: enriched,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async findById(id: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Task not found');
    const enriched = await this.enrichTasks([data]);
    return enriched[0];
  }

  async update(id: string, dto: UpdateTaskDto, userId: string) {
    const supabase = this.supabaseService.getClient();
    const existing = await this.findById(id);

    const updateData = { ...dto, updated_at: new Date().toISOString() };
    if (dto.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
      updateData['completed_at'] = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    if (dto.status && dto.status !== existing.status) {
      await this.logActivity(id, userId, 'STATUS_CHANGED',
        `Status changed from ${existing.status} to ${dto.status}`, existing.status, dto.status);
    }
    if (dto.assigned_to && dto.assigned_to !== existing.assigned_to) {
      await this.logActivity(id, userId, 'ASSIGNED', `Reassigned to user ${dto.assigned_to}`);
    }

    return data;
  }

  async delete(id: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { message: 'Task deleted successfully' };
  }

  async getNotes(taskId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('task_notes')
      .select('*, users!task_notes_created_by_fkey(id, email, first_name, last_name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async addNote(taskId: string, dto: CreateNoteDto, userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('task_notes')
      .insert({
        task_id: taskId,
        note_text: dto.note_text,
        is_private: dto.is_private || false,
        created_by: userId,
      })
      .select('*')
      .single();

    if (error) throw error;

    await this.logActivity(taskId, userId, 'NOTE_ADDED', 'Note added to task');
    return data;
  }

  async getActivities(taskId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('task_activities')
      .select('*, users!task_activities_user_id_fkey(id, email, first_name, last_name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getDashboardStats(userId: string, userRole: string) {
    const supabase = this.supabaseService.getClient();

    if (userRole === 'REP') {
      let builder = supabase.from('tasks').select('*').eq('assigned_to', userId);

      const { data: tasks } = await builder;
      const allTasks = tasks || [];
      const total = allTasks.length;
      const completed = allTasks.filter(t => t.status === 'COMPLETED').length;
      const pending = allTasks.filter(t => t.status === 'PENDING').length;
      const inProgress = allTasks.filter(t => t.status === 'IN_PROGRESS').length;
      const now = new Date();

      const openTasks = allTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
      const upcoming = openTasks.filter(t => t.due_date && new Date(t.due_date) > now);
      const overdue_tasks = openTasks.filter(t => t.due_date && new Date(t.due_date) <= now);

      const enrichedUpcoming = await this.enrichTasks(upcoming);
      const enrichedOverdue = await this.enrichTasks(overdue_tasks);

      return {
        total,
        completed,
        pending,
        inProgress,
        overdue: overdue_tasks.length,
        upcoming: enrichedUpcoming,
        overdue_tasks: enrichedOverdue,
      };
    }

    // MANAGER and ADMIN dashboard
    let query = supabase.from('tasks').select('*');

    if (userRole === 'MANAGER') {
      const { data: assignments } = await supabase
        .from('manager_rep_assignments')
        .select('rep_id')
        .eq('manager_id', userId);
      const repIds = (assignments || []).map(a => a.rep_id);
      repIds.push(userId);
      query = query.in('assigned_to', repIds);
    }

    const { data: tasks } = await query;
    const allTasks = tasks || [];
    const total = allTasks.length;
    const completed = allTasks.filter(t => t.status === 'COMPLETED').length;
    const pending = allTasks.filter(t => t.status === 'PENDING').length;
    const inProgress = allTasks.filter(t => t.status === 'IN_PROGRESS').length;
    const cancelled = allTasks.filter(t => t.status === 'CANCELLED').length;
    const now = new Date();
    const overdue = allTasks.filter(t =>
      t.due_date && new Date(t.due_date) <= now &&
      t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
    ).length;

    const recent_tasks = await this.enrichTasks(
      allTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)
    );

    return { total, completed, pending, in_progress: inProgress, overdue, recent_tasks };
  }

  private async enrichTasks(tasks: any[]) {
    if (!tasks || tasks.length === 0) return tasks;

    const supabase = this.supabaseService.getClient();
    const userIds = new Set<string>();
    for (const task of tasks) {
      if (task.assigned_to) userIds.add(task.assigned_to);
      if (task.assigned_by) userIds.add(task.assigned_by);
      if (task.created_by) userIds.add(task.created_by);
    }

    if (userIds.size === 0) return tasks;

    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', [...userIds]);

    const userMap = new Map((users || []).map(u => [u.id, u]));

    return tasks.map(task => ({
      ...task,
      assigned_to: task.assigned_to ? userMap.get(task.assigned_to) || task.assigned_to : null,
      assigned_by: task.assigned_by ? userMap.get(task.assigned_by) || task.assigned_by : null,
      created_by: task.created_by ? userMap.get(task.created_by) || task.created_by : null,
    }));
  }

  private async logActivity(
    taskId: string, userId: string, activityType: string,
    description: string, oldValue?: string, newValue?: string,
  ) {
    const supabase = this.supabaseService.getClient();
    await supabase.from('task_activities').insert({
      task_id: taskId,
      user_id: userId,
      activity_type: activityType,
      description,
      old_value: oldValue || null,
      new_value: newValue || null,
    });
  }
}
