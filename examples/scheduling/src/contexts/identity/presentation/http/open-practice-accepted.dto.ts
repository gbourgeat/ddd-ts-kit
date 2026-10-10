import { IsString } from 'class-validator';

export class OpenPracticeAccepted {
  @IsString()
  id = '';
}
