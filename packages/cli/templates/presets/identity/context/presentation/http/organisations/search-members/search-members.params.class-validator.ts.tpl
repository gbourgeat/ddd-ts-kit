import { IsNotEmpty, IsString } from 'class-validator';

export class SearchMembersParams {
  @IsString()
  @IsNotEmpty()
  organisationId = '';
}
