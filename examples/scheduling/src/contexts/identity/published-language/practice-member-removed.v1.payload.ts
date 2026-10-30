import { IsIn, IsString } from 'class-validator';

export class PracticeMemberRemovedV1Payload {
  @IsString()
  declare practiceId: string;

  @IsString()
  declare personId: string;

  @IsIn(['manager', 'practitioner', 'assistant'])
  declare role: 'manager' | 'practitioner' | 'assistant';
}
