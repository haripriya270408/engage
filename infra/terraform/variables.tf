variable "aws_region" {
  description = "AWS Region to deploy to"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name of the project used for naming resources"
  type        = string
  default     = "engage"
}

variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  sensitive   = true
}

variable "supabase_service_role_key" {
  description = "Supabase service role key"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT Secret for authentication"
  type        = string
  sensitive   = true
}

variable "groq_api_key" {
  description = "Groq API Key"
  type        = string
  sensitive   = true
}

variable "outlook_client_id" {
  description = "Outlook Client ID"
  type        = string
  sensitive   = true
}

variable "outlook_client_secret" {
  description = "Outlook Client Secret"
  type        = string
  sensitive   = true
}

variable "outlook_tenant_id" {
  description = "Outlook Tenant ID"
  type        = string
  sensitive   = true
}

variable "salesforce_client_id" {
  description = "Salesforce Client ID"
  type        = string
  sensitive   = true
}

variable "salesforce_client_secret" {
  description = "Salesforce Client Secret"
  type        = string
  sensitive   = true
}

variable "salesforce_username" {
  description = "Salesforce Username"
  type        = string
  sensitive   = true
}

variable "salesforce_password" {
  description = "Salesforce Password"
  type        = string
  sensitive   = true
}

variable "salesforce_security_token" {
  description = "Salesforce Security Token"
  type        = string
  sensitive   = true
}

variable "salesforce_login_url" {
  description = "Salesforce Login URL"
  type        = string
}
