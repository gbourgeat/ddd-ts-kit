/** A tenant id outside the grammar of `isTenantId`: refused where it comes in, never altered. */
export class InvalidTenantIdError extends Error {
  constructor(readonly tenantId: string) {
    super(`Invalid tenant id ${JSON.stringify(tenantId.slice(0, 80))}: only letters, digits, "_" and "-", at most 63`);
    this.name = 'InvalidTenantIdError';
  }
}
