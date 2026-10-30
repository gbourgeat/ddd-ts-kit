import { IsBoolean, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GrantDelegationBody {
  @IsString()
  @IsNotEmpty()
  declare assistantId: string;

  /** Left out, the delegation does not include the right to change the availability: the controller reads the absence as `false`. */
  @IsOptional()
  @IsBoolean()
  declare availabilityIncluded?: boolean;

  @IsOptional()
  @IsISO8601()
  declare endsAt?: string;
}
