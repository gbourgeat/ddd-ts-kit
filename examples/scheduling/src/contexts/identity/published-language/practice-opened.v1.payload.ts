import { IsString } from 'class-validator';

export class PracticeOpenedV1Payload {
  @IsString()
  declare practiceId: string;

  @IsString()
  declare name: string;

  @IsString()
  declare timeZone: string;

  @IsString()
  declare managerId: string;
}
