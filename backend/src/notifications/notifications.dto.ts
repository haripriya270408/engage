import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  user_id: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  link?: string;
}

export class ReminderSettingsDto {
  @IsOptional()
  @IsString()
  reminder_time?: string;

  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;
}
