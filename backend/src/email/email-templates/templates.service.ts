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

  async findAll(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .or(`is_shared.eq.true,created_by.eq.${userId}`)
      .order('created_at', { ascending: false });
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
