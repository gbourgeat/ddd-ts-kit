import { IsNotEmpty, IsString } from 'class-validator';

export class ListPracticeAgendaParams {
  @IsString()
  @IsNotEmpty()
  practiceId = '';
}
