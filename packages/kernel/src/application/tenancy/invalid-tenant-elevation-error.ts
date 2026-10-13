/** An elevation that names no reason or no tenant: refused before anything is recorded or run. */
export class InvalidTenantElevationError extends Error {
  constructor(detail: string) {
    super(`Invalid tenant elevation: ${detail}`);
    this.name = 'InvalidTenantElevationError';
  }
}
