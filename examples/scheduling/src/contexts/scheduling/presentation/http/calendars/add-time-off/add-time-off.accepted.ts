import { IsString } from 'class-validator';

export class AddTimeOffAccepted {
  @IsString()
  id = '';
}
