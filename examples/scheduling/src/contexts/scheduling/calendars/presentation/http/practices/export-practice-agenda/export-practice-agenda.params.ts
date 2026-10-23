import { IsNotEmpty, IsString } from 'class-validator';

export class ExportPracticeAgendaParams {
  @IsString()
  @IsNotEmpty()
  practiceId = '';
}
