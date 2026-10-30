import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { RoleName } from '@/contexts/identity/domain/vocabularies/role-name.vocabulary';

export class AddMemberBody {
  @IsString()
  @IsNotEmpty()
  declare personId: string;

  @IsIn(Object.values(RoleName))
  declare role: string;
}
