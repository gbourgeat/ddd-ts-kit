import { IsString } from 'class-validator';

export class RevokeDelegationAccepted {
  @IsString()
  declare id: string;
}
