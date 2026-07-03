import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTaskDto, UpdateTaskDto, TaskFilterDto, CreateNoteDto } from './tasks.dto';
import { SalesforceService } from '../salesforce/salesforce.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private supabaseService: SupabaseService,
    private salesforceService: SalesforceService,
  ) {}

  async create(dto: CreateTaskDto, userId: string, userRole?: string) {
    const supabase = this.supabaseService.getClient();
    const assignedTo = userRole === 'REP' ? userId : (dto.assigned_to || null);
    const taskData = {
      ...dto,
      assigned_to: assignedTo,
      created_by: userId,
      assigned_by: assignedTo ? userId : null,
      status: 'PENDING',
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select('*')
      .single();

    if (error) throw error;

    await this.logActivity(data.id, userId, 'CREATED', 'Task created');

    if (assignedTo) {
      await this.logActivity(data.id, userId, 'ASSIGNED', `Task assigned to user ${assignedTo}`);
    }

    // Sync to Salesforce (fire-and-forget)
    this.syncCreateToSalesforce(data, userId).catch(err =>
      this.logger.error(`SF sync failed for new task ${data.id}: ${err.message}`),
    );

    return data;
  }

  private async syncCreateToSalesforce(task: any, userId: string): Promise<void> {
    const sfId = await this.salesforceService.createSFTask(userId, task);
    if (sfId) {
      const supabase = this.supabaseService.getClient();
      await supabase.from('tasks').update({ salesforce_id: sfId }).eq('id', task.id);
      this.logger.log(`Linked task ${task.id} → SF ${sfId}`);
    }
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
    if (filters.overdue === 'true') {
      builder = builder
        .neq('status', 'COMPLETED')
        .neq('status', 'CANCELLED')
        .lte('due_date', new Date().toISOString());
    }

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

    // Sync to Salesforce
    if (data.salesforce_id) {
      // Task already exists in SF — update it
      this.salesforceService.updateSFTask(userId, data.salesforce_id, dto).catch(err =>
        this.logger.error(`SF update sync failed for task ${id}: ${err.message}`),
      );
    } else {
      // Task doesn't exist in SF yet — create it (with the current/updated status)
      this.syncCreateToSalesforce({ ...data, ...dto }, userId).catch(err =>
        this.logger.error(`SF create sync failed for task ${id}: ${err.message}`),
      );
    }

    return data;
  }

  async delete(id: string) {
    const supabase = this.supabaseService.getClient();

    // Fetch salesforce_id and created_by before deleting
    const { data: task } = await supabase
      .from('tasks')
      .select('salesforce_id, created_by')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Sync deletion to Salesforce if linked using the task creator's SF connection
    if (task?.salesforce_id && task?.created_by) {
      this.salesforceService.deleteSFTask(task.created_by, task.salesforce_id).catch(err =>
        this.logger.error(`SF delete sync failed for task ${id}: ${err.message}`),
      );
    }

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
      const pending = allTasks.filter(t => t.status === 'PENDING').length;
      const now = new Date();

      // Overdue definition
      const openTasks = allTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
      const upcoming = openTasks.filter(t => t.due_date && new Date(t.due_date) > now);
      const overdue_tasks = openTasks.filter(t => t.due_date && new Date(t.due_date) <= now);

      const enrichedUpcoming = await this.enrichTasks(upcoming);
      const enrichedOverdue = await this.enrichTasks(overdue_tasks);

      // Grouped tasks for the dashboard
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const todayTasks = allTasks.filter(t => {
        if (t.status === 'CANCELLED') return false;
        if (!t.due_date) return false;
        const d = new Date(t.due_date);
        const isDueToday = d >= startOfToday && d <= endOfToday;
        const isOverdue = d < startOfToday && t.status !== 'COMPLETED';
        return isDueToday || isOverdue;
      });

      const todayCompleted = todayTasks.filter(t => t.status === 'COMPLETED');
      const inProgressTasks = allTasks.filter(t => t.status === 'IN_PROGRESS');
      const upcomingTasks = allTasks.filter(t => {
        if (t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
        if (!t.due_date) return false;
        const d = new Date(t.due_date);
        return d > endOfToday;
      });
      const completedTasks = allTasks.filter(t => t.status === 'COMPLETED');

      const enrichedToday = await this.enrichTasks(todayTasks);
      const enrichedInProgress = await this.enrichTasks(inProgressTasks);
      const enrichedUpcomingTasks = await this.enrichTasks(upcomingTasks);
      const enrichedCompletedTasks = await this.enrichTasks(completedTasks);

      // Fetch recent activities for this user's tasks
      const taskIds = allTasks.map(t => t.id);
      let activities: any[] = [];
      if (taskIds.length > 0) {
        const { data: acts } = await supabase
          .from('task_activities')
          .select('*, tasks(id, title, task_type), users!task_activities_user_id_fkey(id, email, first_name, last_name)')
          .in('task_id', taskIds)
          .order('created_at', { ascending: false })
          .limit(10);
        activities = acts || [];
      }

      return {
        total,
        completed: completedTasks.length,
        pending,
        inProgress: inProgressTasks.length,
        overdue: overdue_tasks.length,
        upcoming: enrichedUpcoming,
        overdue_tasks: enrichedOverdue,
        today_count: todayTasks.length,
        today_completed_count: todayCompleted.length,
        today_tasks: enrichedToday,
        in_progress_tasks: enrichedInProgress,
        upcoming_tasks: enrichedUpcomingTasks,
        completed_tasks: enrichedCompletedTasks,
        activities,
      };
    }

    // MANAGER and ADMIN dashboard
    let query = supabase.from('tasks').select('*');

    let repIds: string[] = [];
    if (userRole === 'MANAGER') {
      const { data: assignments } = await supabase
        .from('manager_rep_assignments')
        .select('rep_id')
        .eq('manager_id', userId);
      repIds = (assignments || []).map(a => a.rep_id);
      repIds.push(userId);
      query = query.in('assigned_to', repIds);
    }

    const { data: tasks } = await query;
    const allTasks = tasks || [];
    const total = allTasks.length;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const completedTasks = allTasks.filter(t => t.status === 'COMPLETED');
    const pending = allTasks.filter(t => t.status === 'PENDING').length;
    const inProgressTasks = allTasks.filter(t => t.status === 'IN_PROGRESS');
    const overdue_tasks = allTasks.filter(t =>
      t.due_date && new Date(t.due_date) <= now &&
      t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
    );

    const todayTasks = allTasks.filter(t => {
      if (t.status === 'CANCELLED') return false;
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      const isDueToday = d >= startOfToday && d <= endOfToday;
      const isOverdue = d < startOfToday && t.status !== 'COMPLETED';
      return isDueToday || isOverdue;
    });

    const todayCompleted = todayTasks.filter(t => t.status === 'COMPLETED');
    const upcomingTasks = allTasks.filter(t => {
      if (t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d > endOfToday;
    });

    const enrichedToday = await this.enrichTasks(todayTasks);
    const enrichedInProgress = await this.enrichTasks(inProgressTasks);
    const enrichedUpcomingTasks = await this.enrichTasks(upcomingTasks);
    const enrichedCompletedTasks = await this.enrichTasks(completedTasks);

    const taskIds = allTasks.map(t => t.id);
    let activities: any[] = [];
    if (taskIds.length > 0) {
      const { data: acts } = await supabase
        .from('task_activities')
        .select('*, tasks(id, title, task_type), users!task_activities_user_id_fkey(id, email, first_name, last_name)')
        .in('task_id', taskIds)
        .order('created_at', { ascending: false })
        .limit(10);
      activities = acts || [];
    }

    // Fetch team reps for manager (for reassign dropdown)
    let teamReps: any[] = [];
    if (userRole === 'MANAGER' && repIds.length > 0) {
      const { data: repsData } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .in('id', repIds);
      teamReps = repsData || [];
    }

    return {
      total,
      completed: completedTasks.length,
      pending,
      inProgress: inProgressTasks.length,
      overdue: overdue_tasks.length,
      today_count: todayTasks.length,
      today_completed_count: todayCompleted.length,
      today_tasks: enrichedToday,
      in_progress_tasks: enrichedInProgress,
      upcoming_tasks: enrichedUpcomingTasks,
      completed_tasks: enrichedCompletedTasks,
      activities,
      team_reps: teamReps,
      // legacy fields
      recent_tasks: enrichedToday.slice(0, 5),
    };
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
