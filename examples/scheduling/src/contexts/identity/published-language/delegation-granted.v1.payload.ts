import { IsBoolean, IsISO8601, IsOptional, IsString } from 'class-validator';

export class DelegationGrantedV1Payload {
  @IsString()
  declare delegationId: string;

  @IsString()
  declare practiceId: string;

  @IsString()
  declare practitionerId: string;

  @IsString()
  declare assistantId: string;

  @IsBoolean()
  declare availabilityIncluded: boolean;

  @IsOptional()
  @IsISO8601()
  declare endsAt?: string;
}
