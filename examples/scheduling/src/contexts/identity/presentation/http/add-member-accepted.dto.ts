import { IsString } from 'class-validator';

export class AddMemberAccepted {
  @IsString()
  id = '';
}
