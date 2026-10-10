import { IsNotEmpty, IsString } from 'class-validator';

export class OpenPracticeBody {
  @IsString()
  @IsNotEmpty()
  name = '';

  @IsString()
  @IsNotEmpty()
  timeZone = '';

  @IsString()
  @IsNotEmpty()
  managerId = '';
}
