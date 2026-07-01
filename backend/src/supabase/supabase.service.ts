import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('SUPABASE_URL')?.trim() || '';
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')?.trim() || '';
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  async query(query: string, params?: any[]) {
    const { data, error } = await this.supabase.rpc('exec_sql', { query_text: query });
    if (error) throw error;
    return data;
  }
}
