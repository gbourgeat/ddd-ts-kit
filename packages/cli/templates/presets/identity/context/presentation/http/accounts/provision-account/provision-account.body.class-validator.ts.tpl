import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ProvisionAccountBody {
  /** Left out, the name the token gives; the email address is always the one of the token. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  displayName?: string;
}
