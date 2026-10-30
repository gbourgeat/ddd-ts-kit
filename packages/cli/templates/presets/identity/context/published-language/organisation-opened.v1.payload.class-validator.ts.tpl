import { IsString } from 'class-validator';

/** An organisation was opened; with tenants, it is a new tenant. Version 1: a field may be added, never renamed nor removed. */
export class OrganisationOpenedV1Payload {
  @IsString()
  declare organisationId: string;

  @IsString()
  declare name: string;

  @IsString()
  declare openedBy: string;
}
