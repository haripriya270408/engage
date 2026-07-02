import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AdminService {
  constructor(private supabaseService: SupabaseService) {}

  async approveUser(userId: string, approvedById: string, managerId?: string) {
    const supabase = this.supabaseService.getClient();

    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (findError || !user) throw new NotFoundException('User not found');
    if (user.is_approved) throw new BadRequestException('User already approved');

    const updateData: any = {
      is_approved: true,
      approved_at: new Date().toISOString(),
      status: 'ACTIVE',
      updated_at: new Date().toISOString(),
    };

    if (approvedById !== '00000000-0000-0000-0000-000000000001') {
      updateData.approved_by = approvedById;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, email, first_name, last_name, role, status, is_approved')
      .single();

    if (error) throw error;

    if (managerId && user.role === 'REP') {
      await supabase
        .from('manager_rep_assignments')
        .upsert(
          { manager_id: managerId, rep_id: userId },
          { onConflict: 'manager_id,rep_id' },
        );
    }

    return data;
  }

  async rejectUser(userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (findError || !user) throw new NotFoundException('User not found');
    if (user.is_approved) throw new BadRequestException('User is already approved');

    const { data, error } = await supabase
      .from('users')
      .update({
        status: 'INACTIVE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id, email, first_name, last_name, role, status')
      .single();

    if (error) throw error;
    return data;
  }

  async assignRepToManager(repId: string, managerId: string) {
    const supabase = this.supabaseService.getClient();

    // Verify rep exists and is a REP
    const { data: rep, error: repError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', repId)
      .single();

    if (repError || !rep) throw new NotFoundException('Rep not found');
    if (rep.role !== 'REP') throw new BadRequestException('User is not a Sales Rep');

    // Verify manager exists and is a MANAGER
    const { data: manager, error: managerError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', managerId)
      .single();

    if (managerError || !manager) throw new NotFoundException('Manager not found');
    if (manager.role !== 'MANAGER') throw new BadRequestException('Target user is not a Manager');

    // Remove ALL existing manager assignments for this rep (enforces one-manager-per-rep)
    await supabase
      .from('manager_rep_assignments')
      .delete()
      .eq('rep_id', repId);

    // Insert the new assignment
    const { data, error } = await supabase
      .from('manager_rep_assignments')
      .insert({ manager_id: managerId, rep_id: repId })
      .select()
      .single();

    if (error) throw error;
    return { message: 'Rep assigned to manager successfully', assignment: data };
  }

  async getAssignments() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('manager_rep_assignments')
      .select(`
        id,
        assigned_at,
        manager:manager_id ( id, first_name, last_name, email ),
        rep:rep_id ( id, first_name, last_name, email )
      `)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getPendingApprovals() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_approved', false)
      .neq('role', 'ADMIN')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getDashboardStats() {
    const supabase = this.supabaseService.getClient();

    const [totalUsers, totalManagers, totalReps, pendingApprovals, totalTasks, pendingUsersData, managersData] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'MANAGER').eq('status', 'ACTIVE'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'REP').eq('status', 'ACTIVE'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_approved', false).neq('role', 'ADMIN'),
      supabase.from('tasks').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('id, email, first_name, last_name, role, created_at').eq('is_approved', false).neq('role', 'ADMIN').order('created_at', { ascending: true }),
      supabase.from('users').select('id, email, first_name, last_name').eq('role', 'MANAGER').eq('status', 'ACTIVE').order('first_name', { ascending: true }),
    ]);

    return {
      total_users: totalUsers.count || 0,
      total_managers: totalManagers.count || 0,
      total_reps: totalReps.count || 0,
      pending_approvals: pendingApprovals.count || 0,
      total_tasks: totalTasks.count || 0,
      pending_users: pendingUsersData.data || [],
      managers: managersData.data || [],
    };
  }
}
