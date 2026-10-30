import { IsString } from 'class-validator';

export class RemoveMemberAccepted {
  @IsString()
  declare id: string;
}
