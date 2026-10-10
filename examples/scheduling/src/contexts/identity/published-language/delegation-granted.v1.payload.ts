import { IsBoolean, IsISO8601, IsOptional, IsString } from 'class-validator';

export class DelegationGrantedV1Payload {
  @IsString()
  delegationId = '';

  @IsString()
  practiceId = '';

  @IsString()
  practitionerId = '';

  @IsString()
  assistantId = '';

  @IsBoolean()
  availabilityIncluded = false;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;
}
