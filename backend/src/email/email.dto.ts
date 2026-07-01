import { IsString, IsOptional, IsUUID, IsBoolean, IsArray } from 'class-validator';

export class CreateEmailTemplateDto {
  @IsString()
  name: string;

  @IsString()
  subject: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  is_shared?: boolean;
}

export class UpdateEmailTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  is_shared?: boolean;
}

export class SendEmailDto {
  @IsString()
  subject: string;

  @IsString()
  body: string;

  @IsArray()
  to_emails: string[];

  @IsOptional()
  @IsArray()
  cc_emails?: string[];

  @IsOptional()
  @IsUUID()
  task_id?: string;

  @IsOptional()
  @IsString()
  thread_id?: string;
}

export class SaveDraftDto {
  @IsString()
  subject: string;

  @IsString()
  body: string;

  @IsArray()
  to_emails: string[];

  @IsOptional()
  @IsArray()
  cc_emails?: string[];

  @IsOptional()
  @IsUUID()
  task_id?: string;

  @IsOptional()
  @IsString()
  thread_id?: string;
}

export class AiComposeDto {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsString()
  context?: string;
}
