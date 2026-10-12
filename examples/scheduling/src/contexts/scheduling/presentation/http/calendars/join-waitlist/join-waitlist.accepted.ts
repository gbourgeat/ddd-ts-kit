import { IsString } from 'class-validator';

export class JoinWaitlistAccepted {
  @IsString()
  id = '';
}
