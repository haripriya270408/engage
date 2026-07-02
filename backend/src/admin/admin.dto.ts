import { IsUUID, IsOptional } from 'class-validator';

export class ApproveUserDto {
  @IsUUID()
  user_id: string;

  @IsOptional()
  @IsUUID()
  manager_id?: string;
}

export class AssignRepDto {
  @IsUUID()
  rep_id: string;

  @IsUUID()
  manager_id: string;
}
