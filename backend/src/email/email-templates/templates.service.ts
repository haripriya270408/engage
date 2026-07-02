import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from '../email.dto';

@Injectable()
export class TemplatesService {
  constructor(private supabaseService: SupabaseService) {}

  async create(dto: CreateEmailTemplateDto, userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('email_templates')
      .insert({ ...dto, created_by: userId })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async findAll(userId: string, userRole: string) {
    const supabase = this.supabaseService.getClient();
    let query = supabase.from('email_templates').select('*');

    if (userRole === 'REP') {
      const { data: assignments } = await supabase
        .from('manager_rep_assignments')
        .select('manager_id')
        .eq('rep_id', userId)
        .maybeSingle();

      if (assignments) {
        query = query.or(`created_by.eq.${assignments.manager_id},is_shared.eq.true`);
      } else {
        query = query.eq('is_shared', true);
      }
    } else {
      query = query.or(`is_shared.eq.true,created_by.eq.${userId}`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async findById(id: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) throw new NotFoundException('Template not found');
    return data;
  }

  async update(id: string, dto: UpdateEmailTemplateDto) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('email_templates')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { message: 'Template deleted' };
  }
}
