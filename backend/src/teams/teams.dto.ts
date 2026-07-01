import { IsUUID, IsArray, ArrayNotEmpty } from 'class-validator';

export class AssignRepsDto {
  @IsUUID()
  manager_id: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  rep_ids: string[];
}

export class TeamResponse {
  manager: any;
  reps: any[];
}
