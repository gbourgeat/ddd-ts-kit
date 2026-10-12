import type { TenantDirectory } from '../../application/ports/tenant-directory.js';

/** The tenants it was given, for tests and for a project whose tenants are configuration. */
export class InMemoryTenantDirectory implements TenantDirectory {
  constructor(private readonly ids: readonly string[]) {}

  tenants(): Promise<readonly string[]> {
    return Promise.resolve([...this.ids]);
  }
}
