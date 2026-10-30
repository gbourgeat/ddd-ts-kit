import { IsString } from 'class-validator';

export class ProvisionAccountAccepted {
  @IsString()
  declare id: string;
}
