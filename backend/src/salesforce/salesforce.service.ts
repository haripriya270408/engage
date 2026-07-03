import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';

@Injectable()
export class SalesforceService {
  private readonly logger = new Logger(SalesforceService.name);
  private pkceVerifiers = new Map<string, string>();

  constructor(
    private configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {}

  // ─── OAuth Flow ───────────────────────────────────────────────────

  getAuthorizationUrl(userId: string): string {
    const loginUrl = this.configService.get<string>('SALESFORCE_LOGIN_URL') || 'https://login.salesforce.com';
    const clientId = this.configService.get<string>('SALESFORCE_CLIENT_ID');
    const redirectUri = this.configService.get<string>('SALESFORCE_REDIRECT_URI');

    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    this.pkceVerifiers.set(userId, verifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId || '',
      redirect_uri: redirectUri || '',
      state: userId, // Pass userId so we know who to save tokens for on callback
      prompt: 'login consent',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    return `${loginUrl}/services/oauth2/authorize?${params.toString()}`;
  }

  async handleCallback(code: string, userId: string): Promise<void> {
    const loginUrl = this.configService.get<string>('SALESFORCE_LOGIN_URL') || 'https://login.salesforce.com';
    const tokenUrl = `${loginUrl}/services/oauth2/token`;
    
    const verifier = this.pkceVerifiers.get(userId);
    if (!verifier) {
      this.logger.error(`No PKCE verifier found for user ${userId}`);
      throw new Error('OAuth flow error: PKCE verification failed. Please try connecting again.');
    }
    this.pkceVerifiers.delete(userId);

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: this.configService.get<string>('SALESFORCE_CLIENT_ID') || '',
      client_secret: this.configService.get<string>('SALESFORCE_CLIENT_SECRET') || '',
      redirect_uri: this.configService.get<string>('SALESFORCE_REDIRECT_URI') || '',
      code_verifier: verifier,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      this.logger.error(`Salesforce OAuth callback failed: ${JSON.stringify(data)}`);
      throw new Error(`Salesforce authentication failed: ${data.error_description || data.error}`);
    }

    const supabase = this.supabaseService.getClient();

    const connectionData = {
      user_id: userId,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      instance_url: data.instance_url,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    // Upsert the connection using the unique user_id
    const { error } = await supabase
      .from('salesforce_connections')
      .upsert(connectionData, { onConflict: 'user_id' });

    if (error) {
      this.logger.error(`Failed to save Salesforce connection for user ${userId}: ${error.message}`);
      throw new Error('Failed to save connection details.');
    }

    this.logger.log(`Salesforce successfully connected for user ${userId}`);
  }

  async checkConnectionStatus(userId: string): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('salesforce_connections')
      .select('is_active')
      .eq('user_id', userId)
      .maybeSingle();

    return !!(data && data.is_active);
  }

  async disconnect(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('salesforce_connections')
      .delete()
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to disconnect Salesforce for user ${userId}: ${error.message}`);
      throw new Error('Failed to disconnect Salesforce.');
    }

    this.logger.log(`Salesforce connection deleted for user ${userId}`);
  }

  private async refreshUserToken(userId: string, refreshToken: string): Promise<string> {
    const loginUrl = this.configService.get<string>('SALESFORCE_LOGIN_URL') || 'https://login.salesforce.com';
    const tokenUrl = `${loginUrl}/services/oauth2/token`;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.configService.get<string>('SALESFORCE_CLIENT_ID') || '',
      client_secret: this.configService.get<string>('SALESFORCE_CLIENT_SECRET') || '',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      this.logger.error(`Salesforce token refresh failed for user ${userId}: ${JSON.stringify(data)}`);
      // If refresh fails (e.g. revoked), mark connection as inactive
      const supabase = this.supabaseService.getClient();
      await supabase.from('salesforce_connections').update({ is_active: false }).eq('user_id', userId);
      throw new UnauthorizedException('Salesforce connection expired or revoked. Please reconnect.');
    }

    const newAccessToken = data.access_token;
    
    // Update token in database
    const supabase = this.supabaseService.getClient();
    await supabase
      .from('salesforce_connections')
      .update({ access_token: newAccessToken, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    return newAccessToken;
  }

  private async getUserConnection(userId: string): Promise<any> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('salesforce_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      throw new UnauthorizedException('User is not connected to Salesforce.');
    }
    return data;
  }

  private async sfRequest(userId: string, method: string, path: string, body?: any): Promise<any> {
    const connection = await this.getUserConnection(userId);
    let accessToken = connection.access_token;
    const url = `${connection.instance_url}${path}`;

    const makeRequest = async (token: string) => {
      const options: RequestInit = {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      };
      if (body) options.body = JSON.stringify(body);
      return fetch(url, options);
    };

    let response = await makeRequest(accessToken);

    // If unauthorized, attempt to refresh token
    if (response.status === 401) {
      this.logger.log(`Refreshing Salesforce token for user ${userId}`);
      accessToken = await this.refreshUserToken(userId, connection.refresh_token);
      response = await makeRequest(accessToken);
    }

    // 204 No Content for successful PATCH/DELETE
    if (response.status === 204) return { success: true };

    const data = await response.json();
    if (!response.ok) {
      this.logger.error(`Salesforce API error [${method} ${path}]: ${JSON.stringify(data)}`);
      throw new Error(`Salesforce API error: ${JSON.stringify(data)}`);
    }
    return data;
  }

  // ─── Status / Priority Mapping ─────────────────────────────────────

  private localStatusToSF(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'Not Started',
      IN_PROGRESS: 'In Progress',
      COMPLETED: 'Completed',
      CANCELLED: 'Deferred',
    };
    return map[status] || 'Not Started';
  }

  private sfStatusToLocal(status: string): string {
    const map: Record<string, string> = {
      'Not Started': 'PENDING',
      'In Progress': 'IN_PROGRESS',
      'Completed': 'COMPLETED',
      'Deferred': 'CANCELLED',
      'Waiting on someone else': 'IN_PROGRESS',
    };
    return map[status] || 'PENDING';
  }

  private localPriorityToSF(priority: string): string {
    const map: Record<string, string> = {
      LOW: 'Low',
      MEDIUM: 'Normal',
      HIGH: 'High',
      URGENT: 'High',
    };
    return map[priority] || 'Normal';
  }

  private sfPriorityToLocal(priority: string): string {
    const map: Record<string, string> = {
      Low: 'LOW',
      Normal: 'MEDIUM',
      High: 'HIGH',
    };
    return map[priority] || 'MEDIUM';
  }

  // ─── Local → Salesforce Sync ───────────────────────────────────────

  async createSFTask(userId: string, task: any): Promise<string | null> {
    try {
      const sfTask = {
        Subject: task.title,
        Description: task.description || '',
        Status: this.localStatusToSF(task.status),
        Priority: this.localPriorityToSF(task.priority),
        ActivityDate: task.due_date ? task.due_date.split('T')[0] : null,
      };

      const result = await this.sfRequest(userId, 'POST', '/services/data/v57.0/sobjects/Task', sfTask);
      this.logger.log(`Created Salesforce Task: ${result.id} for user ${userId}`);
      return result.id;
    } catch (err: any) {
      this.logger.error(`Failed to create SF task for user ${userId}: ${err.message}`);
      return null;
    }
  }

  async updateSFTask(userId: string, salesforceId: string, updates: any): Promise<void> {
    try {
      const sfUpdates: any = {};
      if (updates.title !== undefined) sfUpdates.Subject = updates.title;
      if (updates.description !== undefined) sfUpdates.Description = updates.description;
      if (updates.status !== undefined) sfUpdates.Status = this.localStatusToSF(updates.status);
      if (updates.priority !== undefined) sfUpdates.Priority = this.localPriorityToSF(updates.priority);
      if (updates.due_date !== undefined) sfUpdates.ActivityDate = updates.due_date ? updates.due_date.split('T')[0] : null;

      if (Object.keys(sfUpdates).length === 0) return;

      await this.sfRequest(userId, 'PATCH', `/services/data/v57.0/sobjects/Task/${salesforceId}`, sfUpdates);
      this.logger.log(`Updated Salesforce Task: ${salesforceId} for user ${userId}`);
    } catch (err: any) {
      this.logger.error(`Failed to update SF task ${salesforceId} for user ${userId}: ${err.message}`);
    }
  }

  async deleteSFTask(userId: string, salesforceId: string): Promise<void> {
    try {
      await this.sfRequest(userId, 'DELETE', `/services/data/v57.0/sobjects/Task/${salesforceId}`);
      this.logger.log(`Deleted Salesforce Task: ${salesforceId} for user ${userId}`);
    } catch (err: any) {
      this.logger.error(`Failed to delete SF task ${salesforceId} for user ${userId}: ${err.message}`);
    }
  }

  // ─── Salesforce → Local Sync (Polling) ─────────────────────────────

  @Cron(CronExpression.EVERY_5_MINUTES)
  async pollSalesforceUpdates(): Promise<void> {
    this.logger.log('Polling Salesforce for task updates for all connected users...');
    const supabase = this.supabaseService.getClient();

    // Get all active Salesforce connections
    const { data: connections, error } = await supabase
      .from('salesforce_connections')
      .select('user_id, instance_url, access_token, refresh_token')
      .eq('is_active', true);

    if (error || !connections || connections.length === 0) {
      this.logger.log('No active Salesforce connections found.');
      return;
    }

    for (const connection of connections) {
      const userId = connection.user_id;
      try {
        // We will fetch tasks modified in the last 24 hours
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const soql = `SELECT Id, Subject, Description, Status, Priority, ActivityDate, LastModifiedDate FROM Task WHERE LastModifiedDate > ${since} ORDER BY LastModifiedDate DESC LIMIT 200`;

        const result = await this.sfRequest(userId, 'GET', `/services/data/v57.0/query?q=${encodeURIComponent(soql)}`);
        const sfTasks = result.records || [];

        if (sfTasks.length === 0) continue;

        this.logger.log(`Found ${sfTasks.length} updated SF task(s) for user ${userId}.`);

        for (const sfTask of sfTasks) {
          // Check if this SF task already exists locally and belongs to this user
          const { data: existing } = await supabase
            .from('tasks')
            .select('id, title, status, priority, due_date, salesforce_id, assigned_to')
            .eq('salesforce_id', sfTask.Id)
            .maybeSingle();

          const localStatus = this.sfStatusToLocal(sfTask.Status);
          const localPriority = this.sfPriorityToLocal(sfTask.Priority);
          const localDueDate = sfTask.ActivityDate ? new Date(sfTask.ActivityDate).toISOString() : null;

          if (existing) {
            // Update existing local task
            const updatePayload: any = {
              title: sfTask.Subject || existing.title,
              status: localStatus,
              priority: localPriority,
              due_date: localDueDate,
              updated_at: new Date().toISOString(),
            };
            if (sfTask.Description) updatePayload.description = sfTask.Description;

            await supabase
              .from('tasks')
              .update(updatePayload)
              .eq('id', existing.id);

            this.logger.log(`Synced SF task ${sfTask.Id} → local task ${existing.id} (User: ${userId})`);
          } else {
            // Create a new task assigned to this user
            const newTask = {
              title: sfTask.Subject || 'Untitled Salesforce Task',
              description: sfTask.Description || '',
              task_type: 'OTHER',
              status: localStatus,
              priority: localPriority,
              due_date: localDueDate,
              created_by: userId,
              assigned_to: userId,
              salesforce_id: sfTask.Id,
            };

            const { data: inserted, error: insertError } = await supabase
              .from('tasks')
              .insert(newTask)
              .select('id')
              .single();

            if (insertError) {
              this.logger.error(`Failed to insert SF task ${sfTask.Id} for user ${userId}: ${insertError.message}`);
            } else if (inserted) {
              this.logger.log(`Created local task ${inserted.id} from SF task ${sfTask.Id} (User: ${userId})`);
            }
          }
        }
      } catch (err: any) {
        this.logger.error(`Salesforce poll error for user ${userId}: ${err.message}`);
      }
    }
  }
}
