import { IsIn, IsString } from 'class-validator';

export class PracticeMemberRemovedV1Payload {
  @IsString()
  practiceId = '';

  @IsString()
  personId = '';

  @IsIn(['manager', 'practitioner', 'assistant'])
  role: 'manager' | 'practitioner' | 'assistant' = 'manager';
}
