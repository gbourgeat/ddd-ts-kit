import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class RegisterPersonBody {
  @IsString()
  @IsNotEmpty()
  declare displayName: string;

  @IsEmail()
  declare email: string;
}
