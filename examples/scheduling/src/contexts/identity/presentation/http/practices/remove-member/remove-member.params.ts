import { IsString } from 'class-validator';

export class RemoveMemberParams {
  @IsString()
  declare practiceId: string;

  @IsString()
  declare personId: string;
}
