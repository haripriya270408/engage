-- Add salesforce_id column to tasks table for two-way sync
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS salesforce_id VARCHAR(255) UNIQUE;

-- Index for fast lookup by salesforce_id
CREATE INDEX IF NOT EXISTS idx_tasks_salesforce_id ON tasks(salesforce_id);
