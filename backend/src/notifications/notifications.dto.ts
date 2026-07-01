export class CreateNotificationDto {
  user_id: string;
  title: string;
  message?: string;
  type?: string;
  link?: string;
}

export class ReminderSettingsDto {
  reminder_time?: string;
  is_enabled?: boolean;
}
