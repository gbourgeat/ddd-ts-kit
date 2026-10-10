import { IsIn, IsString } from 'class-validator';

export class PracticeMemberAddedV1Payload {
  @IsString()
  practiceId = '';

  @IsString()
  personId = '';

  @IsIn(['manager', 'practitioner', 'assistant'])
  role: 'manager' | 'practitioner' | 'assistant' = 'manager';

  @IsString()
  displayName = '';

  @IsString()
  timeZone = '';
}
