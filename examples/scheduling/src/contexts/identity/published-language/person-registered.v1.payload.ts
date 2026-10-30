import { IsEmail, IsString } from 'class-validator';

export class PersonRegisteredV1Payload {
  @IsString()
  declare personId: string;

  @IsString()
  declare displayName: string;

  @IsEmail()
  declare email: string;
}
