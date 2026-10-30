import { IsString } from 'class-validator';

export class AddMemberParams {
  @IsString()
  declare practiceId: string;
}
