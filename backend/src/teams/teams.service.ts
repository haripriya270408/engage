import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class TeamsService {
  constructor(private supabaseService: SupabaseService) {}

  async assignReps(managerId: string, repIds: string[]) {
    const supabase = this.supabaseService.getClient();

    const { data: manager } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', managerId)
      .single();
    if (!manager || manager.role !== 'MANAGER') {
      throw new BadRequestException('Invalid manager');
    }

    const { data: reps } = await supabase
      .from('users')
      .select('id')
      .in('id', repIds)
      .eq('role', 'REP');

    if (!reps || reps.length !== repIds.length) {
      throw new BadRequestException('One or more reps not found or invalid role');
    }

    const assignments = repIds.map(repId => ({
      manager_id: managerId,
      rep_id: repId,
    }));

    const { error } = await supabase
      .from('manager_rep_assignments')
      .upsert(assignments, { onConflict: 'manager_id,rep_id' });

    if (error) throw error;
    return { message: 'Reps assigned successfully' };
  }

  async unassignRep(managerId: string, repId: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('manager_rep_assignments')
      .delete()
      .eq('manager_id', managerId)
      .eq('rep_id', repId);

    if (error) throw error;
    return { message: 'Rep unassigned successfully' };
  }

  async getManagerTeam(managerId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: assignments, error } = await supabase
      .from('manager_rep_assignments')
      .select(`
        rep_id,
        users!manager_rep_assignments_rep_id_fkey (
          id, email, first_name, last_name, role, status, phone
        )
      `)
      .eq('manager_id', managerId);

    if (error) throw error;

    const reps = (assignments || []).map((a: any) => a.users).filter(Boolean);

    const { data: manager } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, status, phone')
      .eq('id', managerId)
      .single();

    return { manager, reps };
  }

  async getAllTeams() {
    const supabase = this.supabaseService.getClient();

    const { data: managers } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('role', 'MANAGER')
      .eq('status', 'ACTIVE');

    if (!managers) return [];

    const teams = await Promise.all(
      managers.map(async (mgr) => {
        const team = await this.getManagerTeam(mgr.id);
        return team;
      }),
    );

    return teams;
  }

  async getTeamStats(managerId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: assignments } = await supabase
      .from('manager_rep_assignments')
      .select('rep_id')
      .eq('manager_id', managerId);

    const repIds = (assignments || []).map(a => a.rep_id);

    if (repIds.length === 0) {
      return { total_reps: 0, total_tasks: 0, completed_tasks: 0, pending_tasks: 0 };
    }

    const { data: tasks } = await supabase
      .from('tasks')
      .select('status')
      .in('assigned_to', repIds);

    const totalTasks = tasks?.length || 0;
    const completedTasks = tasks?.filter(t => t.status === 'COMPLETED').length || 0;
    const pendingTasks = tasks?.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length || 0;

    return {
      total_reps: repIds.length,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      pending_tasks: pendingTasks,
    };
  }
}
