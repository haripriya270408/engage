import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AdminService {
  constructor(private supabaseService: SupabaseService) {}

  async approveUser(userId: string, approvedById: string) {
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

    const [totalUsers, totalManagers, totalReps, pendingApprovals, totalTasks, pendingUsersData] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'MANAGER').eq('status', 'ACTIVE'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'REP').eq('status', 'ACTIVE'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_approved', false).neq('role', 'ADMIN'),
      supabase.from('tasks').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('id, email, first_name, last_name, role, created_at').eq('is_approved', false).neq('role', 'ADMIN').order('created_at', { ascending: true }),
    ]);

    return {
      total_users: totalUsers.count || 0,
      total_managers: totalManagers.count || 0,
      total_reps: totalReps.count || 0,
      pending_approvals: pendingApprovals.count || 0,
      total_tasks: totalTasks.count || 0,
      pending_users: pendingUsersData.data || [],
    };
  }
}
