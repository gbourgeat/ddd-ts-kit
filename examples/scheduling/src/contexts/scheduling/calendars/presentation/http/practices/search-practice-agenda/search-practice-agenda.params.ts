import { IsNotEmpty, IsString } from 'class-validator';

export class SearchPracticeAgendaParams {
  @IsString()
  @IsNotEmpty()
  practiceId = '';
}
