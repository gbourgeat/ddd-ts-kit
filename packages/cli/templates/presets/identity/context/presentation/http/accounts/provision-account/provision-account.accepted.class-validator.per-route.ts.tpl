import { IsString } from 'class-validator';

export class ProvisionAccountAccepted {
  @IsString()
  id = '';
}
