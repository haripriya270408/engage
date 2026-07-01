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

    return {
      data: data || [],
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
    return data;
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
    let query = supabase.from('tasks').select('status', { count: 'exact' });

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

    const { data: tasks } = await query;
    const total = tasks?.length || 0;
    const completed = tasks?.filter(t => t.status === 'COMPLETED').length || 0;
    const pending = tasks?.filter(t => t.status === 'PENDING').length || 0;
    const inProgress = tasks?.filter(t => t.status === 'IN_PROGRESS').length || 0;

    return { total, completed, pending, inProgress };
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
