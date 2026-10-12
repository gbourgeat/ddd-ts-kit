import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { RoleName } from '@/contexts/identity/domain/vocabularies/role-name.vocabulary';

export class AddMemberBody {
  @IsString()
  @IsNotEmpty()
  personId = '';

  @IsIn(Object.values(RoleName))
  role = '';
}
