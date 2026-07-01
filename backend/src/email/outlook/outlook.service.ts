import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OutlookService {
  constructor(
    private supabaseService: SupabaseService,
    private configService: ConfigService,
  ) {}

  async connect(userId: string, authCode: string) {
    const clientId = this.configService.get<string>('OUTLOOK_CLIENT_ID');
    const clientSecret = this.configService.get<string>('OUTLOOK_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('OUTLOOK_REDIRECT_URI');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Outlook integration not configured');
    }

    const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const params = new URLSearchParams();
    params.append('client_id', clientId || '');
    params.append('client_secret', clientSecret || '');
    params.append('code', authCode);
    params.append('redirect_uri', redirectUri || '');
    params.append('grant_type', 'authorization_code');
    params.append('scope', 'User.Read Mail.ReadWrite Mail.Send offline_access');

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const tokens = await response.json();
    if (!response.ok) throw new BadRequestException('Failed to authenticate with Outlook');

    const userInfoRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();

    const supabase = this.supabaseService.getClient();
    const { data: existing } = await supabase
      .from('outlook_connections')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    const connectionData = {
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      outlook_email: userInfo.mail || userInfo.userPrincipalName,
      outlook_user_id: userInfo.id,
      is_active: true,
    };

    if (existing) {
      const { error } = await supabase
        .from('outlook_connections')
        .update(connectionData)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('outlook_connections')
        .insert(connectionData);
      if (error) throw error;
    }

    return { message: 'Outlook connected successfully', email: connectionData.outlook_email };
  }

  async disconnect(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('outlook_connections')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
    return { message: 'Outlook disconnected' };
  }

  async getStatus(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('outlook_connections')
      .select('outlook_email, is_active, token_expires_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data || { connected: false };
  }

  async refreshToken(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data: conn } = await supabase
      .from('outlook_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!conn) throw new BadRequestException('No Outlook connection found');

    const clientId = this.configService.get<string>('OUTLOOK_CLIENT_ID');
    const clientSecret = this.configService.get<string>('OUTLOOK_CLIENT_SECRET');

    const params = new URLSearchParams();
    params.append('client_id', clientId || '');
    params.append('client_secret', clientSecret || '');
    params.append('refresh_token', conn.refresh_token);
    params.append('grant_type', 'refresh_token');
    params.append('scope', 'User.Read Mail.ReadWrite Mail.Send offline_access');

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const tokens = await response.json();
    if (!response.ok) throw new BadRequestException('Failed to refresh token');

    await supabase
      .from('outlook_connections')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || conn.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id);

    return { message: 'Token refreshed' };
  }

  async sendEmail(sendDto: { subject: string; body: string; to_emails: string[]; cc_emails?: string[] }, userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data: conn } = await supabase
      .from('outlook_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!conn) throw new BadRequestException('Outlook not connected');
    if (new Date(conn.token_expires_at) < new Date()) {
      await this.refreshToken(userId);
    }

    const { data: refreshed } = await supabase
      .from('outlook_connections')
      .select('access_token')
      .eq('user_id', userId)
      .single();

    if (!refreshed) throw new BadRequestException('Could not retrieve access token');

    const message = {
      message: {
        subject: sendDto.subject,
        body: { contentType: 'HTML', content: sendDto.body },
        toRecipients: sendDto.to_emails.map(e => ({ emailAddress: { address: e } })),
        ccRecipients: (sendDto.cc_emails || []).map(e => ({ emailAddress: { address: e } })),
      },
    };

    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${refreshed.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) throw new BadRequestException('Failed to send email');

    return { message: 'Email sent successfully' };
  }
}
