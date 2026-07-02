import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';
import { SendEmailDto } from '../email.dto';

@Injectable()
export class OutlookService {
  constructor(
    private supabaseService: SupabaseService,
    private configService: ConfigService,
  ) {}

  private get tenantEndpoint() {
    const tenantId = this.configService.get<string>('OUTLOOK_TENANT_ID');
    return `https://login.microsoftonline.com/${tenantId}`;
  }

  async getAppAccessToken(): Promise<string> {
    const clientId = this.configService.get<string>('OUTLOOK_CLIENT_ID');
    const clientSecret = this.configService.get<string>('OUTLOOK_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Outlook integration not configured');
    }

    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'client_credentials');
    params.append('scope', 'https://graph.microsoft.com/.default');

    const response = await fetch(`${this.tenantEndpoint}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const tokens = await response.json();
    if (!response.ok) {
      throw new BadRequestException('Failed to authenticate with Microsoft Graph App Registration');
    }
    return tokens.access_token;
  }

  async getStatus(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();
    
    if (user) {
      return { connected: true, outlook_email: user.email, email: user.email };
    }
    return { connected: false };
  }

  async sendEmail(dto: SendEmailDto, userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (!user || !user.email) {
      throw new BadRequestException('User email not found');
    }

    const accessToken = await this.getAppAccessToken();

    const message = {
      message: {
        subject: dto.subject,
        body: {
          contentType: 'Text',
          content: dto.body,
        },
        toRecipients: dto.to_emails.map(email => ({ emailAddress: { address: email } })),
        ccRecipients: dto.cc_emails?.map(email => ({ emailAddress: { address: email } })) || [],
      },
      saveToSentItems: 'true',
    };

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${user.email}/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new BadRequestException(`Failed to send email via Outlook: ${errorData.error?.message || 'Unknown error'}`);
    }

    return { message: 'Email sent successfully' };
  }
}
