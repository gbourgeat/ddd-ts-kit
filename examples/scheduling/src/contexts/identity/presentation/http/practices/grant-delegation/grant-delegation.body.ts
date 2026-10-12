import { IsBoolean, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GrantDelegationBody {
  @IsString()
  @IsNotEmpty()
  assistantId = '';

  /** Left out, the delegation does not include the right to change the availability. */
  @IsBoolean()
  availabilityIncluded = false;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;
}
