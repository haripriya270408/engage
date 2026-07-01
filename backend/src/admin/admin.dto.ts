import { IsUUID } from 'class-validator';

export class ApproveUserDto {
  @IsUUID()
  user_id: string;
}
