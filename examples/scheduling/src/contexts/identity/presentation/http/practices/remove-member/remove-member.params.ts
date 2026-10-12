import { IsString } from 'class-validator';

export class RemoveMemberParams {
  @IsString()
  practiceId = '';

  @IsString()
  personId = '';
}
