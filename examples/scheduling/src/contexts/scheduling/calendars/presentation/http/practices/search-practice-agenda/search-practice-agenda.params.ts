import { IsNotEmpty, IsString } from 'class-validator';

export class SearchPracticeAgendaParams {
  @IsString()
  @IsNotEmpty()
  declare practiceId: string;
}
