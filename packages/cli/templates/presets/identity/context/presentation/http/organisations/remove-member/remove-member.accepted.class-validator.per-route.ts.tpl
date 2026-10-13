import { IsString } from 'class-validator';

export class RemoveMemberAccepted {
  @IsString()
  id = '';
}
