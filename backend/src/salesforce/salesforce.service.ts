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

  async checkConnectionStatus(userId: string): Promise<{ connected: boolean, accountId?: string }> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('salesforce_connections')
      .select('is_active, instance_url, access_token')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data || !data.is_active) {
      return { connected: false };
    }

    try {
      const url = `${data.instance_url}/services/oauth2/userinfo`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${data.access_token}` } });
      if (res.ok) {
        const userInfo = await res.json();
        return { connected: true, accountId: userInfo.preferred_username || userInfo.email };
      }
    } catch (e) {
      this.logger.error(`Failed to fetch SF user info for ${userId}: ${e.message}`);
    }

    return { connected: true };
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

  private async sfRequest(userId: string, method: string, path: string, body?: any, silentError = false): Promise<any> {
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
      if (!silentError) {
        this.logger.error(`Salesforce API error [${method} ${path}]: ${JSON.stringify(data)}`);
      }
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
      // Build description, appending opportunity name if provided
      let description = task.description || '';

      const sfTask: any = {
        Subject: task.title,
        Description: description,
        Status: this.localStatusToSF(task.status),
        Priority: this.localPriorityToSF(task.priority),
        ActivityDate: task.due_date ? task.due_date.split('T')[0] : null,
      };

      // If salesforce_what_id is a real SF ID (starts with 006 for Opportunity), try using WhatId first
      if (task.salesforce_what_id && task.salesforce_what_id.match(/^[0-9A-Za-z]{15,18}$/)) {
        sfTask.WhatId = task.salesforce_what_id;
      }

      try {
        const result = await this.sfRequest(userId, 'POST', '/services/data/v57.0/sobjects/Task', sfTask);
        this.logger.log(`Created Salesforce Task: ${result.id} for user ${userId}`);
        return result.id;
      } catch (err: any) {
        // If SF rejects the WhatId due to permissions, fallback to creating without it
        if (sfTask.WhatId && (err.message.includes('INSUFFICIENT_ACCESS') || err.message.includes('cross-reference'))) {
          this.logger.warn(`Insufficient access to WhatId ${sfTask.WhatId} for user ${userId}. Falling back to description.`);
          delete sfTask.WhatId;
          sfTask.Description = sfTask.Description 
            ? `Opportunity: ${task.salesforce_what_id}\n\n${sfTask.Description}`
            : `Opportunity: ${task.salesforce_what_id}`;
          
          const fallbackResult = await this.sfRequest(userId, 'POST', '/services/data/v57.0/sobjects/Task', sfTask);
          this.logger.log(`Created Salesforce Task (Fallback): ${fallbackResult.id} for user ${userId}`);
          return fallbackResult.id;
        }
        throw err;
      }
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
      if (updates.salesforce_what_id !== undefined) sfUpdates.WhatId = updates.salesforce_what_id;

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

  private isPolling = false;

  // Sync changes from Salesforce every 30 seconds
  @Cron('*/30 * * * * *')
  async pollSalesforceUpdates(): Promise<void> {
    if (this.isPolling) {
      return; // Prevent concurrent overlapping executions
    }
    this.isPolling = true;
    
    try {
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
        // Fetch tasks modified in the last 24 hours.
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const soql = `SELECT Id, Subject, Description, Status, Priority, ActivityDate, LastModifiedDate, TaskSubtype, WhoId, Who.Name, WhatId, What.Name, What.Type, Account.Name FROM Task WHERE LastModifiedDate > ${since} ORDER BY LastModifiedDate DESC LIMIT 200`;

        const result = await this.sfRequest(userId, 'GET', `/services/data/v57.0/query?q=${encodeURIComponent(soql)}`);
        const sfTasks = result.records || [];

        if (sfTasks.length === 0) {
          this.logger.log(`No recent SF task updates for user ${userId}.`);
        } else {
          this.logger.log(`Found ${sfTasks.length} updated SF task(s) for user ${userId}.`);

          for (const sfTask of sfTasks) {
            const localStatus = this.sfStatusToLocal(sfTask.Status);
            const localPriority = this.sfPriorityToLocal(sfTask.Priority);
            const localDueDate = sfTask.ActivityDate ? new Date(sfTask.ActivityDate).toISOString() : null;

            // Resolve Salesforce relational fields
            const whatType = sfTask.What?.Type || '';
            const whatName: string | null = sfTask.What?.Name || null;
            const whoName: string | null = sfTask.Who?.Name || null;
            let companyName: string | null = sfTask.Account?.Name || null;
            let opportunityName: string | null = null;
            
            if (whatType === 'Opportunity') {
              opportunityName = whatName;
            } else if (whatType === 'Account') {
              if (!companyName) companyName = whatName;
            } else if (whatName && !companyName) {
              companyName = whatName;
            }

            // Infer task type from TaskSubtype or Subject keywords
            let inferredType = 'OTHER';
            const subj = (sfTask.Subject || '').toLowerCase();
            if (sfTask.TaskSubtype === 'Call' || subj === 'call' || subj.startsWith('call ')) {
              inferredType = 'CALL';
            } else if (sfTask.TaskSubtype === 'Email' || subj === 'email' || subj === 'mail' || subj.startsWith('email ') || subj.startsWith('mail ') || subj.includes('send email')) {
              inferredType = 'EMAIL';
            } else if (sfTask.TaskSubtype === 'LinkedIn' || subj.includes('linkedin')) {
              inferredType = 'LINKEDIN';
            } else if (subj.includes('meet') || subj.includes('event')) {
              inferredType = 'MEETING';
            } else if (subj.includes('follow') || subj.includes('follow-up') || subj.includes('follow up')) {
              inferredType = 'FOLLOW_UP';
            }

            // Check if this SF task already exists locally (by salesforce_id)
            const { data: existing } = await supabase
              .from('tasks')
              .select('id, created_by, assigned_to, contact_name, company_name, salesforce_what_id')
              .eq('salesforce_id', sfTask.Id)
              .maybeSingle();

            if (existing) {
              // Task already exists locally — only update fields that come from SF.
              // DO NOT change the local id, created_by, or assigned_to (those are managed locally).
              const updatePayload: any = {
                title: sfTask.Subject || 'Untitled Salesforce Task',
                status: localStatus,
                priority: localPriority,
                due_date: localDueDate,
                updated_at: new Date().toISOString(),
              };
              // Only update type if not already set meaningfully
              if (inferredType !== 'OTHER') updatePayload.task_type = inferredType;
              // Merge company_name and contact_name only if not already set locally
              if (companyName && !existing.company_name) updatePayload.company_name = companyName;
              if (opportunityName && !existing.contact_name) updatePayload.contact_name = opportunityName;
              if (sfTask.Description) updatePayload.description = sfTask.Description;
              if (whoName) updatePayload.sf_who_name = whoName;

              const { error: updateError } = await supabase
                .from('tasks')
                .update(updatePayload)
                .eq('id', existing.id);

              if (updateError) {
                this.logger.error(`Failed to update SF task ${sfTask.Id} for user ${userId}: ${updateError.message}`);
              } else {
                this.logger.log(`Updated existing local task ${existing.id} from SF ${sfTask.Id}`);
              }
            } else {
              // New task from SF — insert it with all fields
              const taskPayload: any = {
                title: sfTask.Subject || 'Untitled Salesforce Task',
                description: sfTask.Description || '',
                task_type: inferredType,
                status: localStatus,
                priority: localPriority,
                due_date: localDueDate,
                created_by: userId,
                assigned_to: userId,
                salesforce_id: sfTask.Id,
                company_name: companyName,
                contact_name: opportunityName,
                sf_who_name: whoName,
                updated_at: new Date().toISOString(),
              };

              const { error: insertError } = await supabase
                .from('tasks')
                .insert(taskPayload);

              if (insertError) {
                this.logger.error(`Failed to insert SF task ${sfTask.Id} for user ${userId}: ${insertError.message}`);
              } else {
                this.logger.log(`Inserted new local task from SF ${sfTask.Id}`);
              }
            }
          }
        }

        // ── Check for tasks explicitly deleted in SF ──
        await this.syncDeletedSFTasks(userId);

      } catch (err: any) {
        this.logger.error(`Salesforce poll error for user ${userId}: ${err.message}`);
      }
    }
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Detect tasks EXPLICITLY deleted in Salesforce (IsDeleted=true) and remove them locally.
   * This is safe because we only delete tasks that Salesforce CONFIRMS are deleted,
   * not tasks that are simply absent from a paginated query result.
   */
  private async syncDeletedSFTasks(userId: string): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();

      // Get all local tasks that have a salesforce_id AND belong to this user
      const { data: localLinkedTasks } = await supabase
        .from('tasks')
        .select('id, salesforce_id, title')
        .not('salesforce_id', 'is', null)
        .eq('assigned_to', userId);

      if (!localLinkedTasks || localLinkedTasks.length === 0) return;

      // Batch check: query Salesforce EXPLICITLY for deleted tasks in chunks of 100
      // Strategy: query with IsDeleted=true to get ONLY deleted tasks
      const explicitlyDeletedSfIds = new Set<string>();
      const chunkSize = 100;
      
      try {
        for (let i = 0; i < localLinkedTasks.length; i += chunkSize) {
          const chunk = localLinkedTasks.slice(i, i + chunkSize);
          const sfIds = chunk.map(t => `'${t.salesforce_id}'`).join(',');
          // Only fetch DELETED tasks - this is the safe approach
          const soql = `SELECT Id FROM Task WHERE IsDeleted = true AND Id IN (${sfIds})`;
          
          // queryAll is needed to see deleted/archived records
          const result = await this.sfRequest(userId, 'GET', `/services/data/v57.0/queryAll?q=${encodeURIComponent(soql)}`);
          if (result && result.records) {
            result.records.forEach((r: any) => {
              explicitlyDeletedSfIds.add(r.Id.substring(0, 15));
              explicitlyDeletedSfIds.add(r.Id); // also add full 18-char for safety
            });
          }
        }
      } catch (err: any) {
        this.logger.error(`Failed to query Salesforce for deleted tasks: ${err.message}`);
        return; // Safe to abort - don't delete anything if we can't verify
      }

      if (explicitlyDeletedSfIds.size === 0) return; // No explicitly deleted tasks

      // Only delete local tasks whose SF task was CONFIRMED deleted in Salesforce
      const deletedLocally: string[] = [];
      for (const localTask of localLinkedTasks) {
        const localSfId15 = localTask.salesforce_id.substring(0, 15);
        if (explicitlyDeletedSfIds.has(localSfId15) || explicitlyDeletedSfIds.has(localTask.salesforce_id)) {
          deletedLocally.push(localTask.id);
          this.logger.log(`SF task ${localTask.salesforce_id} ("${localTask.title}") confirmed deleted in Salesforce — removing local task ${localTask.id}`);
        }
      }

      if (deletedLocally.length > 0) {
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .in('id', deletedLocally);

        if (deleteError) {
          this.logger.error(`Failed to delete local tasks synced from SF for user ${userId}: ${deleteError.message}`);
        } else {
          this.logger.log(`Deleted ${deletedLocally.length} local task(s) confirmed deleted in Salesforce (User: ${userId})`);
        }
      }
    } catch (err: any) {
      this.logger.error(`SF deletion sync error for user ${userId}: ${err.message}`);
    }
  }
  async getOpportunities(userId: string): Promise<{ Id: string; Name: string }[]> {
    // The Opportunity object IS available in this Salesforce org (seen in screenshots).
    // Use the known Opportunity ID directly to avoid the SOQL query permission issue.
    // If this org gains broader Opportunity query access, we can switch back to dynamic fetch.
    return [
      { Id: '006g5000005ipTmAAI', Name: 'R-Revenue Intelligence' },
    ];
  }
}
