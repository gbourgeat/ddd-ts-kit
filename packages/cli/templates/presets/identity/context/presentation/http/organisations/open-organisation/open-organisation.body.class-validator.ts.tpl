import { IsNotEmpty, IsString } from 'class-validator';

export class OpenOrganisationBody {
  /** Lower-case letters, digits and hyphens: the identifier of the organisation, for good. */
  @IsString()
  @IsNotEmpty()
  slug = '';

  @IsString()
  @IsNotEmpty()
  name = '';
}
