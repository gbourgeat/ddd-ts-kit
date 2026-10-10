import { IsEmail, IsString } from 'class-validator';

export class PersonRegisteredV1Payload {
  @IsString()
  personId = '';

  @IsString()
  displayName = '';

  @IsEmail()
  email = '';
}
