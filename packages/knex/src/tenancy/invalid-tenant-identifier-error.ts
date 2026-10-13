/** A tenant id that cannot name a schema: refused rather than escaped into an identifier. */
export class InvalidTenantIdentifierError extends Error {
  constructor(tenantId: string, reason: string) {
    super(`The tenant id "${tenantId}" cannot name a schema: ${reason}`);
    this.name = 'InvalidTenantIdentifierError';
  }
}
