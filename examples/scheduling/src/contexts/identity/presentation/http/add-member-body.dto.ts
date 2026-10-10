import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class AddMemberBody {
  @IsString()
  @IsNotEmpty()
  personId = '';

  @IsIn(['manager', 'practitioner', 'assistant'])
  role = '';
}
