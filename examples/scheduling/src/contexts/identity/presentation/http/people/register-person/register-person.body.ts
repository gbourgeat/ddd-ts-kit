import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class RegisterPersonBody {
  @IsString()
  @IsNotEmpty()
  displayName = '';

  @IsEmail()
  email = '';
}
