import { IsString } from 'class-validator';

export class OpenOrganisationAccepted {
  @IsString()
  id = '';
}
