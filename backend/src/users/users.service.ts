import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateUserDto, UserResponse } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private supabaseService: SupabaseService) {}

  async findAll(query: { role?: string; status?: string; page?: number; limit?: number }) {
    const supabase = this.supabaseService.getClient();
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    let builder = supabase
      .from('users')
      .select('*', { count: 'exact' });

    if (query.role) builder = builder.eq('role', query.role);
    if (query.status) builder = builder.eq('status', query.status);

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

  async findById(id: string): Promise<UserResponse> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('User not found');
    return data;
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponse> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('User not found');
    return data;
  }

  async findByRole(role: string): Promise<UserResponse[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', role)
      .eq('status', 'ACTIVE')
      .order('first_name', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}
