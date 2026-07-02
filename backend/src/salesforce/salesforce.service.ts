import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SalesforceService {
  private readonly logger = new Logger(SalesforceService.name);
  private accessToken: string | null = null;
  private instanceUrl: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {}

  // ─── Authentication ────────────────────────────────────────────────

  private async authenticate(): Promise<void> {
    // Return cached token if still valid (tokens last ~2 hours)
    if (this.accessToken && Date.now() < this.tokenExpiresAt) return;

    const loginUrl = this.configService.get<string>('SALESFORCE_LOGIN_URL') || 'https://login.salesforce.com';
    const tokenUrl = `${loginUrl}/services/oauth2/token`;

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
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
      this.logger.error(`Salesforce auth failed: ${JSON.stringify(data)}`);
      throw new Error(`Salesforce authentication failed: ${data.error_description || data.error}`);
    }

    this.accessToken = data.access_token;
    this.instanceUrl = data.instance_url;
    // Salesforce tokens typically last ~2 hours; refresh 10 min early
    this.tokenExpiresAt = Date.now() + 110 * 60 * 1000;
    this.logger.log(`Salesforce authenticated via Client Credentials. Instance: ${this.instanceUrl}`);
  }

  private async sfRequest(method: string, path: string, body?: any): Promise<any> {
    await this.authenticate();

    const url = `${this.instanceUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);

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

  async createSFTask(task: any): Promise<string | null> {
    try {
      const sfTask = {
        Subject: task.title,
        Description: task.description || '',
        Status: this.localStatusToSF(task.status),
        Priority: this.localPriorityToSF(task.priority),
        ActivityDate: task.due_date ? task.due_date.split('T')[0] : null,
      };

      const result = await this.sfRequest('POST', '/services/data/v57.0/sobjects/Task', sfTask);
      this.logger.log(`Created Salesforce Task: ${result.id}`);
      return result.id;
    } catch (err: any) {
      this.logger.error(`Failed to create SF task: ${err.message}`);
      return null;
    }
  }

  async updateSFTask(salesforceId: string, updates: any): Promise<void> {
    try {
      const sfUpdates: any = {};
      if (updates.title !== undefined) sfUpdates.Subject = updates.title;
      if (updates.description !== undefined) sfUpdates.Description = updates.description;
      if (updates.status !== undefined) sfUpdates.Status = this.localStatusToSF(updates.status);
      if (updates.priority !== undefined) sfUpdates.Priority = this.localPriorityToSF(updates.priority);
      if (updates.due_date !== undefined) sfUpdates.ActivityDate = updates.due_date ? updates.due_date.split('T')[0] : null;

      if (Object.keys(sfUpdates).length === 0) return;

      await this.sfRequest('PATCH', `/services/data/v57.0/sobjects/Task/${salesforceId}`, sfUpdates);
      this.logger.log(`Updated Salesforce Task: ${salesforceId}`);
    } catch (err: any) {
      this.logger.error(`Failed to update SF task ${salesforceId}: ${err.message}`);
    }
  }

  async deleteSFTask(salesforceId: string): Promise<void> {
    try {
      await this.sfRequest('DELETE', `/services/data/v57.0/sobjects/Task/${salesforceId}`);
      this.logger.log(`Deleted Salesforce Task: ${salesforceId}`);
    } catch (err: any) {
      this.logger.error(`Failed to delete SF task ${salesforceId}: ${err.message}`);
    }
  }

  // ─── Salesforce → Local Sync (Polling) ─────────────────────────────

  @Cron(CronExpression.EVERY_5_MINUTES)
  async pollSalesforceUpdates(): Promise<void> {
    this.logger.log('Polling Salesforce for task updates...');
    const supabase = this.supabaseService.getClient();

    try {
      await this.authenticate();
    } catch {
      this.logger.warn('Salesforce auth failed during poll — skipping this cycle.');
      return;
    }

    try {
      // Fetch tasks modified in the last 24 hours (with overlap buffer to prevent timezone offsets missing tasks)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const soql = `SELECT Id, Subject, Description, Status, Priority, ActivityDate, LastModifiedDate, Owner.Email FROM Task WHERE LastModifiedDate > ${since} ORDER BY LastModifiedDate DESC LIMIT 200`;

      const result = await this.sfRequest('GET', `/services/data/v57.0/query?q=${encodeURIComponent(soql)}`);
      const sfTasks = result.records || [];

      if (sfTasks.length === 0) {
        this.logger.log('No updated Salesforce tasks found.');
        return;
      }

      this.logger.log(`Found ${sfTasks.length} updated Salesforce task(s).`);

      for (const sfTask of sfTasks) {
        // Check if this SF task already exists locally
        const { data: existing } = await supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, salesforce_id, assigned_to')
          .eq('salesforce_id', sfTask.Id)
          .maybeSingle();

        const localStatus = this.sfStatusToLocal(sfTask.Status);
        const localPriority = this.sfPriorityToLocal(sfTask.Priority);
        const localDueDate = sfTask.ActivityDate ? new Date(sfTask.ActivityDate).toISOString() : null;

        // Try to match Salesforce Owner.Email with local user (case-insensitive)
        let assignedToUser: string | null = null;
        if (sfTask.Owner && sfTask.Owner.Email) {
          const { data: matchedUser } = await supabase
            .from('users')
            .select('id')
            .ilike('email', sfTask.Owner.Email.trim())
            .maybeSingle();
          if (matchedUser) {
            assignedToUser = matchedUser.id;
          }
        }

        if (existing) {
          // Update existing local task with Salesforce changes
          const updatePayload: any = {
            title: sfTask.Subject || existing.title,
            status: localStatus,
            priority: localPriority,
            due_date: localDueDate,
            updated_at: new Date().toISOString(),
          };
          if (sfTask.Description) updatePayload.description = sfTask.Description;
          if (assignedToUser) updatePayload.assigned_to = assignedToUser;

          await supabase
            .from('tasks')
            .update(updatePayload)
            .eq('id', existing.id);

          this.logger.log(`Synced SF task ${sfTask.Id} → local task ${existing.id}`);
        } else {
          // Get a default user to assign the task to if owner email doesn't match
          const { data: defaultUser } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'ADMIN')
            .eq('status', 'ACTIVE')
            .limit(1)
            .single();

          if (!defaultUser && !assignedToUser) {
            this.logger.warn(`No active admin found to assign SF task ${sfTask.Id} — skipping.`);
            continue;
          }

          const newTask = {
            title: sfTask.Subject || 'Untitled Salesforce Task',
            description: sfTask.Description || '',
            task_type: 'OTHER',
            status: localStatus,
            priority: localPriority,
            due_date: localDueDate,
            created_by: assignedToUser || defaultUser!.id,
            assigned_to: assignedToUser || null,
            salesforce_id: sfTask.Id,
          };

          const { data: inserted, error } = await supabase
            .from('tasks')
            .insert(newTask)
            .select('id')
            .single();

          if (error) {
            this.logger.error(`Failed to insert SF task ${sfTask.Id}: ${error.message}`);
          } else {
            this.logger.log(`Created local task ${inserted.id} from SF task ${sfTask.Id}`);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Salesforce poll error: ${err.message}`);
    }
  }
}
