import { IsString } from 'class-validator';

export class PracticeOpenedV1Payload {
  @IsString()
  practiceId = '';

  @IsString()
  name = '';

  @IsString()
  timeZone = '';

  @IsString()
  managerId = '';
}
