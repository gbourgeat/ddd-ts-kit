import { IsNotEmpty, IsString } from 'class-validator';

export class OpenPracticeBody {
  @IsString()
  @IsNotEmpty()
  declare name: string;

  @IsString()
  @IsNotEmpty()
  declare timeZone: string;

  @IsString()
  @IsNotEmpty()
  declare managerId: string;
}
